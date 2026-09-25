import type { NextApiRequest, NextApiResponse } from "next";
import { reviewRequestSchema } from "@/lib/coach/schema";
import { runReview, type ReviewRunResult } from "@/lib/coach/server/review";
import {
  BUSY_ERROR,
  abortOnDisconnect,
  acquireCallSlot,
  guardLocalRequest,
  sendError,
  toApiError,
  type ApiResponse,
} from "@/lib/coach/server/http";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ReviewRunResult>>
) {
  if (!guardLocalRequest(req, res)) return;

  const parsed = reviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "bad_request",
      message: "Invalid review request.",
    });
  }

  const { packet, gameSans, model } = parsed.data;
  const release = acquireCallSlot();
  if (!release) return sendError(res, BUSY_ERROR);

  try {
    const data = await runReview(packet, gameSans, {
      model,
      signal: abortOnDisconnect(res),
    });
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, toApiError(error));
  } finally {
    release();
  }
}
