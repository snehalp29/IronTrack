const DELETED_EMAIL_DOMAIN = 'deleted.local';

export function buildDeletedUserEmail(
  userId: string,
  deletedAt: Date = new Date(),
): string {
  return `deleted+${userId}+${deletedAt.getTime()}@${DELETED_EMAIL_DOMAIN}`;
}
