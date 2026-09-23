// Importing every model once guarantees they are registered before populate() calls.
// Safe for CLI scripts: models only depend on client-safe constants.
export { default as User } from "./User.js";
export { default as SubscriptionPlan } from "./SubscriptionPlan.js";
export { default as Subscription } from "./Subscription.js";
export { default as Payment } from "./Payment.js";
export { default as BetCode } from "./BetCode.js";
export { default as Category } from "./Category.js";
export { default as Notification } from "./Notification.js";
export { default as AuditLog } from "./AuditLog.js";
export { default as Setting } from "./Setting.js";
export { default as RateLimit } from "./RateLimit.js";
export { default as MessageOutbox } from "./MessageOutbox.js";
export { default as Favorite } from "./Favorite.js";
export { default as BetCodeView } from "./BetCodeView.js";
export { default as Broadcast } from "./Broadcast.js";

import User from "./User.js";
import SubscriptionPlan from "./SubscriptionPlan.js";
import Subscription from "./Subscription.js";
import Payment from "./Payment.js";
import BetCode from "./BetCode.js";
import Category from "./Category.js";
import Notification from "./Notification.js";
import AuditLog from "./AuditLog.js";
import Setting from "./Setting.js";
import RateLimit from "./RateLimit.js";
import MessageOutbox from "./MessageOutbox.js";
import Favorite from "./Favorite.js";
import BetCodeView from "./BetCodeView.js";
import Broadcast from "./Broadcast.js";

/** Every model, e.g. for creating indexes from scripts. */
export const models = [User, SubscriptionPlan, Subscription, Payment, BetCode, Category, Notification, AuditLog, Setting, RateLimit, MessageOutbox, Favorite, BetCodeView, Broadcast];
