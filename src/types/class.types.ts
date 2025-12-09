export type ClassStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived' | 'cancelled';
export type ClassMemberRole = 'teacher' | 'student' | 'admin';
export type JoinedVia = 'invitation' | 'join_link' | 'direct_add';
export type MemberStatus = 'active' | 'removed' | 'dropped';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface ScheduleTime {
  days: string[];
  start_time: string;
  end_time: string;
  timezone: string;
}

export interface Class {
  id: string;
  class_name: string;
  department_id: string;
  semester: string;
  description?: string;
  creator_id: string;
  school_id: string;
  max_students: number;
  status: ClassStatus;
  start_date?: Date;
  end_date?: Date;
  schedule_time?: ScheduleTime;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClassDTO {
  class_name: string;
  department_id: string;
  semester: string;
  description?: string;
  max_students?: number;
  status?: ClassStatus;
  start_date?: Date;
  end_date?: Date;
  schedule_time?: ScheduleTime;
}

export interface UpdateClassDTO {
  class_name?: string;
  department_id?: string;
  semester?: string;
  description?: string;
  max_students?: number;
  status?: ClassStatus;
  start_date?: Date;
  end_date?: Date;
  schedule_time?: ScheduleTime;
  is_active?: boolean;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  role: ClassMemberRole;
  joined_at: Date;
  joined_via: JoinedVia;
  status: MemberStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AddClassMemberDTO {
  user_id: string;
  role: ClassMemberRole;
  joined_via: JoinedVia;
}

export interface ClassInvitation {
  id: string;
  class_id: string;
  invited_by: string;
  invited_email: string;
  role: 'teacher' | 'student';
  status: InvitationStatus;
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInvitationDTO {
  invited_email: string;
  role: 'teacher' | 'student';
  expires_at?: Date;
}

export interface ClassJoinLink {
  id: string;
  class_id: string;
  role: 'teacher' | 'student';
  token: string;
  created_by: string;
  max_uses?: number;
  current_uses: number;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJoinLinkDTO {
  role: 'teacher' | 'student';
  max_uses?: number;
  expires_at?: Date;
}

export interface JoinLinkUsage {
  id: string;
  join_link_id: string;
  user_id: string;
  used_at: Date;
}
