// ============================================================================
// NKST Digital Platform — Admin Frontend TypeScript Contracts
// Mirrors NestJS API (nkst_api) Prisma schema, DTOs, and JSON:API 1.1 envelope
// ============================================================================

export type AdminRole = 'PLATFORM_ADMIN' | 'CHURCH_ADMIN' | 'GROUP_ADMIN';
export type UserRole = 'VISITOR' | 'MEMBER' | AdminRole;

export type ChurchStatus = 'active' | 'inactive';
export type Gender = 'male' | 'female';
export type VerificationState =
  | 'registered'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'suspended';
export type ProfileVisibility = 'public' | 'private';

export type VerificationPathway = 'catechism' | 'acknowledgement' | 'church' | 'platform';
export type VerificationRequestStatus =
  | 'submitted'
  | 'ready_for_review'
  | 'approved'
  | 'rejected';

export type PostType = 'text' | 'image' | 'video' | 'document';
export type PostCategory =
  | 'general'
  | 'news'
  | 'notice'
  | 'advert'
  | 'important'
  | 'announcement';
export type Audience = 'general' | 'church' | 'group';
export type PostStatus =
  | 'held_unverified'
  | 'draft'
  | 'pending_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'removed';

export type ModerationSubjectType = 'post' | 'photo' | 'resource';
export type ModerationActionType =
  | 'approve'
  | 'reject'
  | 'request_correction'
  | 'hide'
  | 'remove';

export type ReportSubjectType = 'post' | 'comment' | 'photo';
export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'misinformation'
  | 'minor_removal_request'
  | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';

export type GroupScope = 'church' | 'national';
export type GroupVisibility = 'public' | 'private';
export type GroupJoinMode = 'open' | 'approval';
export type GenderRestriction = 'any' | 'male' | 'female';
export type GroupStatus = 'active' | 'archived';
export type GroupMemberRole = 'member' | 'admin';
export type GroupJoinRequestStatus = 'held_unverified' | 'pending' | 'approved' | 'rejected';

export type PhotoCategory =
  | 'worship_service'
  | 'events'
  | 'choir_and_music'
  | 'youth'
  | 'women'
  | 'men'
  | 'outreach'
  | 'buildings'
  | 'other';
export type PhotoStatus =
  | 'held_unverified'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'removed';

export type ResourceCategory =
  | 'sermons'
  | 'hymns_and_music'
  | 'books_and_publications'
  | 'study_and_training'
  | 'forms_and_templates'
  | 'other';
export type ResourceType = 'document' | 'audio' | 'video' | 'image' | 'physical';
export type ResourceFormat = 'digital' | 'hard_copy';
export type ResourceAccess = 'free' | 'paid';
export type ResourceStatus =
  | 'held_unverified'
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived';

export type SellerPlan =
  | 'one_month'
  | 'one_year'
  | 'two_years'
  | 'three_years'
  | 'four_years'
  | 'five_years'
  | 'lifetime';
export type SellerAccessStatus = 'active' | 'expired' | 'revoked';

export type OrderStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'fulfilled'
  | 'awaiting_delivery'
  | 'received'
  | 'closed'
  | 'cancelled';

export type RecitationStatus = 'draft' | 'published';

export type DirectMessageStatus = 'pending_approval' | 'approved' | 'rejected';
export type KeywordSeverity = 'low' | 'medium' | 'high';

export interface DirectMessageRecord {
  id: string;
  senderId: string;
  recipientId: string;
  churchId: string;
  subject?: string | null;
  body: string;
  status: DirectMessageStatus;
  isFlagged: boolean;
  matchedKeywords: string[];
  reviewNote?: string | null;
  rejectionReason?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: MemberCard;
  recipient?: MemberCard;
  church?: ChurchSummary;
}

export interface FlaggedKeywordRecord {
  id: string;
  keyword: string;
  severity: KeywordSeverity;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// Church Positions & Per-Branch Permissions (02-hq / 03-branch)
// ============================================================================

export type PositionPermissionKey =
  | 'members.view'
  | 'members.edit'
  | 'members.verify'
  | 'positions.assign'
  | 'branch.super_admin';

export interface MyBranchPermissionsResponse {
  branchId: string | null;
  permissions: PositionPermissionKey[];
}

export interface PermissionCatalogItem {
  key: PositionPermissionKey;
  label: string;
  description: string;
  warning?: string;
}

export interface HqPositionRecord {
  id: string;
  title: string;
  description: string;
  maxSeats: number | null;
  seatLabel: string;
  isActive: boolean;
  branchesUsingCount: number;
  activeAssignmentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchPositionHolder {
  assignmentId: string;
  memberId: string;
  fullName: string;
  photoUrl?: string | null;
  startedAt: string;
}

export interface BranchPositionRecord {
  id: string;
  title: string;
  description: string;
  maxSeats: number | null;
  seatLabel: string;
  filled: number;
  remaining: number | null;
  isFull: boolean;
  permissions: PositionPermissionKey[];
  holders: BranchPositionHolder[];
}

export interface BranchPositionPermissionsResponse {
  churchId: string;
  positionId: string;
  positionTitle: string;
  permissions: PositionPermissionKey[];
}

// ============================================================================
// JSON:API 1.1 Envelopes
// ============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  timestamp?: string;
}

export interface JsonApiSuccess<T> {
  jsonapi?: { version: string };
  data: T;
  meta?: Partial<PaginationMeta> & { timestamp?: string };
  links?: { self?: string };
}

export interface JsonApiErrorItem {
  status?: string;
  title?: string;
  detail?: string;
  source?: { pointer?: string };
}

export interface JsonApiErrorResponse {
  jsonapi?: { version: string };
  errors?: JsonApiErrorItem[];
  message?: string | string[];
  meta?: { timestamp?: string; path?: string; method?: string };
}

export interface ApiResult<T> {
  data: T;
  meta?: Partial<PaginationMeta> & { timestamp?: string };
}

// ============================================================================
// Domain Entities
// ============================================================================

export interface ChurchSummary {
  id: string;
  name: string;
  state?: string;
  lga?: string;
  town?: string;
  status?: ChurchStatus;
}

export interface MemberSocialLink {
  id: string;
  label: string;
  url: string;
}

export interface MemberProfile {
  id: string;
  firstName: string;
  middleName?: string | null;
  surname: string;
  fullName: string;
  email?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  photoUrl?: string | null;
  bio?: string | null;
  state?: string;
  lga?: string;
  residentialLocation?: string;
  churchId: string;
  church?: ChurchSummary;
  verificationState: VerificationState;
  isVerified: boolean;
  verificationBadge: string;
  profileVisibility: ProfileVisibility;
  isPlatformAdmin?: boolean;
  churchPosition?: string | null;
  roles?: string[];
  suspensionReason?: string | null;
  socialLinks?: MemberSocialLink[];
}

export interface MemberCard {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  churchId: string;
  church?: ChurchSummary;
  isVerified: boolean;
  verificationBadge: string;
  profileVisibility: ProfileVisibility;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
  reactivated?: boolean;
  suspensionNotice?: {
    suspended: boolean;
    readOnly: boolean;
    reason: string;
  } | null;
  member: MemberProfile;
}

export interface SessionRecord {
  id: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface RolePermissionEntry {
  permission: {
    id: string;
    code: string;
    description?: string | null;
  };
}

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string | null;
  permissions?: RolePermissionEntry[];
}

export interface PermissionDefinition {
  id: string;
  code: string;
  description?: string | null;
}

export interface MemberRoleAssignment {
  id: string;
  memberId: string;
  roleId: string;
  churchId?: string | null;
  groupId?: string | null;
  assignedBy?: string | null;
  createdAt: string;
  role: {
    id: string;
    name: string;
    description?: string | null;
  };
}

export interface AdminCounts {
  totalChurches: number;
  openReports: number;
  membersByVerificationState: Array<{ verificationState: VerificationState; count: number }>;
  membersByState: Array<{ state: string; count: number }>;
  membersByChurch: Array<{ churchId: string; count: number }>;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    firstName: string;
    surname: string;
    email: string;
  } | null;
}

export interface ModerationActionEntry {
  id: string;
  subjectType: ModerationSubjectType;
  subjectId: string;
  moderatorId: string;
  action: ModerationActionType;
  reason?: string | null;
  createdAt: string;
  moderator?: {
    id: string;
    firstName: string;
    surname: string;
  } | null;
}

export interface ChurchRecord {
  id: string;
  name: string;
  state: string;
  lga: string;
  town: string;
  address: string;
  landmark?: string | null;
  phones: string[];
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string | null;
  adminMemberId?: string | null;
  isHeadquarters: boolean;
  status: ChurchStatus;
  createdAt: string;
  updatedAt: string;
  adminMember?: MemberCard | { id: string; firstName: string; surname: string; email?: string } | null;
  _count?: {
    members?: number;
    posts?: number;
    groups?: number;
    resources?: number;
  };
}

export interface ChurchMapPin {
  id: string;
  name: string;
  state: string;
  lga: string;
  town: string;
  latitude: number | null;
  longitude: number | null;
  status: ChurchStatus;
}

export interface ChurchDetailRecord extends ChurchRecord {
  verifiedMemberCount: number;
  marketplaceCount: number;
  recentPosts: PostRecord[];
  galleryPreview: PhotoRecord[];
  recentResources: ResourceRecord[];
}

export interface NigerianLocation {
  state: string;
  lgas: string[];
}

export interface VerificationRequestRecord {
  id: string;
  memberId: string;
  churchId: string;
  pathway: VerificationPathway;
  evidenceText?: string | null;
  evidenceFileUrl?: string | null;
  programme?: string | null;
  completionDate?: string | null;
  status: VerificationRequestStatus;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  member?: MemberProfile | MemberCard;
  church?: ChurchSummary;
  acknowledgements?: Array<{
    id: string;
    acknowledgerId: string;
    note?: string | null;
    createdAt: string;
    acknowledger?: MemberCard;
  }>;
  _count?: { acknowledgements?: number };
}

export interface PostMediaRecord {
  id: string;
  kind: 'image' | 'video' | 'document';
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
}

export interface PostRecord {
  id: string;
  authorId: string;
  churchId: string;
  type: PostType;
  category: PostCategory;
  audience: Audience;
  audienceChurchId?: string | null;
  audienceGroupId?: string | null;
  body?: string | null;
  status: PostStatus;
  isOfficial: boolean;
  publisherLabel?: string | null;
  isPinned: boolean;
  pinnedUntil?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  author?: MemberCard;
  church?: ChurchSummary;
  media?: PostMediaRecord[];
}

export interface ReportRecord {
  id: string;
  subjectType: ReportSubjectType;
  subjectId: string;
  reporterId: string;
  reason: ReportReason;
  detail?: string | null;
  status: ReportStatus;
  handledById?: string | null;
  handledAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  reporter?: MemberCard;
  handledBy?: MemberCard | null;
}

export interface GroupRecord {
  id: string;
  name: string;
  description: string;
  coverUrl?: string | null;
  scope: GroupScope;
  churchId?: string | null;
  visibility: GroupVisibility;
  joinMode: GroupJoinMode;
  genderRestriction: GenderRestriction;
  minAge?: number | null;
  maxAge?: number | null;
  verifiedOnly: boolean;
  status: GroupStatus;
  createdAt: string;
  church?: ChurchSummary | null;
  _count?: {
    members?: number;
    joinRequests?: number;
  };
}

export interface GroupMemberRecord {
  id: string;
  groupId: string;
  memberId: string;
  role: GroupMemberRole;
  joinedAt: string;
  member?: MemberCard;
}

export interface GroupJoinRequestRecord {
  id: string;
  groupId: string;
  memberId: string;
  status: GroupJoinRequestStatus;
  reason?: string | null;
  createdAt: string;
  member?: MemberCard;
}

export interface AlbumRecord {
  id: string;
  galleryId: string;
  title: string;
  description?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  createdAt: string;
  _count?: { photos?: number };
}

export interface PhotoRecord {
  id: string;
  albumId?: string | null;
  churchId: string;
  uploaderId: string;
  fileUrl: string;
  caption?: string | null;
  category: PhotoCategory;
  eventName?: string | null;
  hasMinors: boolean;
  consentConfirmed: boolean;
  parentalConsentConfirmed?: boolean;
  status: PhotoStatus;
  createdAt: string;
  uploader?: MemberCard;
  church?: ChurchSummary;
  album?: { id: string; title: string } | null;
}

export interface ResourceFileRecord {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPreviewImage: boolean;
}

export interface ResourceRecord {
  id: string;
  ownerId: string;
  churchId: string;
  title: string;
  description: string;
  category: ResourceCategory;
  resourceType: ResourceType;
  format: ResourceFormat;
  access: ResourceAccess;
  price?: number | string | null;
  currency?: string;
  stock?: number | null;
  status: ResourceStatus;
  isChurchOwned: boolean;
  reviewNote?: string | null;
  createdAt: string;
  owner?: MemberCard;
  church?: ChurchSummary;
  files?: ResourceFileRecord[];
}

export interface FulfilmentOrderRecord {
  id: string;
  resourceId: string;
  buyerId: string;
  sellerId: string;
  churchId: string;
  quantity: number;
  status: OrderStatus;
  paymentStatus: string;
  declineReason?: string | null;
  acceptedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  waitingHours?: number;
  resource?: {
    id: string;
    title: string;
    format: ResourceFormat;
    access: ResourceAccess;
    price?: number | string | null;
  };
  buyer?: MemberCard;
  seller?: MemberCard;
  church?: ChurchSummary;
}

export interface RecitationRecord {
  id: string;
  title: string;
  body: string;
  attachmentUrl?: string | null;
  appliesOn: string;
  status: RecitationStatus;
  publishedById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export const SELLER_PLAN_LABELS: Record<SellerPlan, string> = {
  one_month: '1 Month',
  one_year: '1 Year',
  two_years: '2 Years',
  three_years: '3 Years',
  four_years: '4 Years',
  five_years: '5 Years',
  lifetime: 'Lifetime (No Expiry)',
};

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  worship_service: 'Worship Service',
  events: 'Events',
  choir_and_music: 'Choir & Music',
  youth: 'Youth',
  women: 'Women',
  men: 'Men',
  outreach: 'Outreach',
  buildings: 'Buildings',
  other: 'Other',
};

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  sermons: 'Sermons',
  hymns_and_music: 'Hymns & Music',
  books_and_publications: 'Books & Publications',
  study_and_training: 'Study & Training',
  forms_and_templates: 'Forms & Templates',
  other: 'Other',
};
