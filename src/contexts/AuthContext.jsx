/* eslint-disable react-refresh/only-export-components, no-unused-vars */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userDepartment, setUserDepartment] = useState(null)
  const [isStudent, setIsStudent] = useState(false)
  const [studentProfile, setStudentProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentUserId = useRef(null)

  useEffect(() => {
    let isMounted = true
    let isInitialized = false
    
    // Timeout helper to prevent hanging
    const withTimeout = (promise, ms = 8000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), ms)
        )
      ])
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession())
        if (isMounted && session?.user) {
          currentUserId.current = session.user.id
          setUser(session.user)
          await withTimeout(handleUserSession(session.user))
        }
        isInitialized = true
      } catch (err) {
        console.error('Auth init error:', err)
        isInitialized = true
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    
    initAuth()

    // Listen for auth changes - but skip initial session to prevent duplicate processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      // Skip INITIAL_SESSION event - we already handle this in initAuth
      if (event === 'INITIAL_SESSION') {
        return
      }
      
      // If not initialized yet, skip to avoid race condition
      if (!isInitialized) {
        return
      }
      
      try {
        if (session?.user) {
          // Only trigger loading and re-fetch if the user actually changed
          if (currentUserId.current !== session.user.id) {
            currentUserId.current = session.user.id
            if (isMounted) setLoading(true)
            setUser(session.user)
            // Only re-fetch profile on actual sign in, not token refresh
            if (event === 'SIGNED_IN') {
              await withTimeout(handleUserSession(session.user))
            }
          } else {
            // User didn't change, just update the session object silently
            setUser(session.user)
          }
        } else {
          currentUserId.current = null
          setUser(null)
          setUserRole(null)
          setUserDepartment(null)
          setIsStudent(false)
          setStudentProfile(null)
        }
      } catch (err) {
        console.error('Auth state change error:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleUserSession = async (authUser) => {
    try {
      const email = authUser.email || ''

      // Email domain check
      if (!email.endsWith('@liceo.edu.ph')) {
        await supabase.auth.signOut()
        return
      }

      // Parallelize staff/admin check and student profile fetch
      // This runs both queries concurrently instead of sequentially
      const [staffCheckResult, studentResult] = await Promise.all([
        supabase
          .from('users')
          .select('role, department')
          .eq('id', authUser.id)
          .maybeSingle(),
        authUser.app_metadata?.provider === 'google'
          ? supabase
              .from('students')
              .select('*')
              .eq('email', email)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ])

      // Check if staff/admin
      const { data: staffData, error: staffError } = staffCheckResult
      if (staffError && staffError.code !== 'PGRST116') {
        console.error('Error checking staff role:', staffError)
      }

      if (staffData?.role && staffData.role !== 'student') {
        // This is a staff/admin account — must not use student portal
        const formatRole = (role) =>
          role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

        sessionStorage.setItem(
          'wrongRoleError',
          `Your account is a ${formatRole(staffData.role)}. You should login through the correct channels.`
        )
        await supabase.auth.signOut({ scope: 'global' })
        window.location.replace('/student-login')
        return
      }

      // Valid student with Google OAuth
      if (email.endsWith('@liceo.edu.ph') && authUser.app_metadata?.provider === 'google') {
        setIsStudent(true)
        setUserRole('student')

        // Handle student profile
        const { data: student } = studentResult

        if (!student) {
          // Create new student profile
          try {
            const { data: newStudent } = await supabase
              .from('students')
              .insert({
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Student',
                avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
              })
              .select()
              .single()
            setStudentProfile(newStudent)
          } catch (err) {
            console.error('Error creating student profile:', err)
            setStudentProfile({
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Student',
            })
          }
        } else {
          setStudentProfile(student)
        }
      } else {
        // Not a valid student
        setIsStudent(false)
        setUserRole(null)
      }
    } catch (err) {
      console.error('handleUserSession error:', err)
    }
  }

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, department')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user role:', error)
        return
      }

      if (data && data.role) {
        setUserRole(data.role)
        setUserDepartment(data.department)
        setIsStudent(false)
      }
    } catch (err) {
      console.error('fetchUserRole error:', err)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: 'liceo.edu.ph', // Restrict to liceo.edu.ph domain
          prompt: 'select_account', // Force account selection
        },
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    // Clear state immediately
    setUser(null)
    setUserRole(null)
    setUserDepartment(null)
    setIsStudent(false)
    setStudentProfile(null)
    
    // Force clear all Supabase storage FIRST
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    })
    sessionStorage.clear()
    
    try {
      // Sign out from Supabase - wait for completion
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) console.error('Sign out error:', error)
    } catch (err) {
      console.error('Sign out error:', err)
    }
    
    // Force page reload after signout completes
    window.location.replace('/')
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      userRole, 
      userDepartment, 
      isStudent,
      studentProfile,
      loading, 
      signIn, 
      signInWithGoogle,
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  )
}
