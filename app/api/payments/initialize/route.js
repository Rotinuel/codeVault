import { checkoutHandler } from "@/lib/checkout-route";

// Generic checkout: the server decides whether this is a new subscription,
// a renewal or an upgrade based on the user's current subscription.
export const POST = checkoutHandler("subscribe");
