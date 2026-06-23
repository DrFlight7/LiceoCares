-- Liceo Cares Feedback Management System
-- Supabase Database Schema
-- 
-- NOTE: In the UI, "complaints" are now referred to as "feedback", 
-- but the underlying database tables and columns retain the "complaint" naming convention.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for Admin and Department Officers)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'department')),
  department TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complaint comments/chat table
CREATE TABLE IF NOT EXISTS complaint_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('student', 'admin', 'department')),
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments table for dynamic category management
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  student_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('academic', 'facilities', 'finance', 'staff', 'security', 'other')),
  description TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  resolution_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected', 'in_progress', 'resolved')),
  assigned_department TEXT,
  admin_remarks TEXT,
  department_remarks TEXT,
  resolution_details TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  started_by UUID REFERENCES users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES users(id),
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complaint attachments table for multiple evidence files
CREATE TABLE IF NOT EXISTS complaint_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  attachment_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint ON complaint_attachments(complaint_id);

-- Insert default departments
INSERT INTO departments (name, code, description, is_active) VALUES
  ('Academic Affairs', 'academic', 'Academic-related concerns and issues', true),
  ('Facilities Management', 'facilities', 'Building, equipment, and facility concerns', true),
  ('Finance Office', 'finance', 'Financial and payment-related matters', true),
  ('Staff Relations', 'staff', 'Staff behavior and conduct issues', true),
  ('Security Office', 'security', 'Safety and security concerns', true),
  ('Other', 'other', 'General concerns not covered by other categories', true)
ON CONFLICT (code) DO NOTHING;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_id_role ON users(id, role);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_id ON students(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaints_reference ON complaints(reference_number);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_department ON complaints(assigned_department);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_complaint ON audit_trail(complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_complaint ON complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON complaint_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

-- Sample admin user (run this after creating the user in Supabase Auth)
-- Replace 'YOUR_ADMIN_USER_ID' with the actual UUID from auth.users
-- INSERT INTO users (id, email, role, full_name)
-- VALUES ('YOUR_ADMIN_USER_ID', 'admin@liceo.edu.ph', 'admin', 'VP Admin');

-- Sample department user
-- INSERT INTO users (id, email, role, department, full_name)
-- VALUES ('YOUR_DEPT_USER_ID', 'academic@liceo.edu.ph', 'department', 'academic', 'Academic Affairs Officer');
