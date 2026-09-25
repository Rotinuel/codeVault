import mongoose from "mongoose";
import { DEFAULT_CURRENCY, TICKET_STATUS, TICKET_STATUS_VALUES } from "../lib/constants.js";

const { Schema } = mongoose;

// A winning betting slip uploaded by a client. The Super Admin reviews it;
// approved uploads count towards the monthly target for a discount and,
// if the client agreed, can appear anonymously in the homepage carousel.
const WinningTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: TICKET_STATUS_VALUES, default: TICKET_STATUS.PENDING },

    bookmaker: { type: String, trim: true, maxlength: 40, required: true },
    // Ticket / booking / bet ID printed on the slip, used to check it with the bookmaker.
    ticketRef: { type: String, trim: true, maxlength: 60, required: true },
    stake: { type: Number, min: 0, required: true },
    payout: { type: Number, min: 0, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
    wonAt: { type: Date, required: true },
    codeUsed: { type: String, trim: true, maxlength: 60, default: "" },
    note: { type: String, trim: true, maxlength: 300, default: "" },

    // Image kept in MongoDB (re-encoded to JPEG in the browser, which also strips EXIF/GPS data).
    image: {
      data: { type: Buffer, select: false },
      contentType: { type: String, default: "image/jpeg" },
      size: { type: Number, default: 0 },
    },
    imageHash: { type: String, index: true },
    // "BOOKMAKER:TICKETREF" while pending/approved; cleared on rejection so it can be resubmitted.
    dedupeKey: { type: String, default: null },

    showcaseConsent: { type: Boolean, default: false },
    showcase: { type: Boolean, default: false },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 300, default: "" },

    // Set when the discount this ticket's month earned has been paid for.
    redeemedPayment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    redeemedAt: { type: Date, default: null },

    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

WinningTicketSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
WinningTicketSchema.index({ status: 1, createdAt: -1 });
WinningTicketSchema.index({ user: 1, status: 1, createdAt: -1 });
WinningTicketSchema.index({ status: 1, showcase: 1, reviewedAt: -1 });

export default mongoose.models.WinningTicket || mongoose.model("WinningTicket", WinningTicketSchema);
