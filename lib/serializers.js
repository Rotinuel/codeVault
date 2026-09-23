// Explicit allow-list serializers: only these fields ever reach the client.

export function publicUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    status: u.status,
    notificationPrefs: {
      whatsapp: u.notificationPrefs?.whatsapp ?? true,
      betCodes: u.notificationPrefs?.betCodes ?? true,
      payments: u.notificationPrefs?.payments ?? true,
      subscription: u.notificationPrefs?.subscription ?? true,
      marketing: u.notificationPrefs?.marketing ?? false,
    },
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt ?? null,
  };
}

export function adminUser(u) {
  return {
    ...publicUser(u),
    statusReason: u.statusReason ?? null,
    lastSeenAt: u.lastSeenAt ?? null,
    updatedAt: u.updatedAt ?? null,
  };
}

export function serializePlan(p) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    description: p.description || "",
    price: p.price,
    currency: p.currency,
    durationDays: p.durationDays,
    accessLevel: p.accessLevel,
    features: p.features || [],
    historyDays: p.historyDays ?? null,
    priorityNotifications: Boolean(p.priorityNotifications),
    isActive: Boolean(p.isActive),
    isFeatured: Boolean(p.isFeatured),
    badge: p.badge || "",
    sortOrder: p.sortOrder ?? 0,
  };
}

export function serializeCategory(c) {
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    color: c.color,
    isActive: Boolean(c.isActive),
    showAsTab: Boolean(c.showAsTab),
    sortOrder: c.sortOrder ?? 0,
  };
}

export function serializeNotification(n) {
  return {
    id: String(n._id),
    title: n.title,
    message: n.message,
    type: n.type,
    read: Boolean(n.read),
    link: n.link ?? null,
    createdAt: n.createdAt,
  };
}
