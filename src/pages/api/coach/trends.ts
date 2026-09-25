import type { NextApiRequest, NextApiResponse } from "next";
import { trendsRequestSchema } from "@/lib/coach/schema";
import { runTrends, type TrendsRunResult } from "@/lib/coach/server/review";
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
  api: { bodyParser: { sizeLimit: "2mb" } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<TrendsRunResult>>
) {
  if (!guardLocalRequest(req, res)) return;

  const parsed = trendsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "bad_request",
      message: "Trends need at least 2 reviewed games.",
    });
  }

  const { digests, model } = parsed.data;
  const release = acquireCallSlot();
  if (!release) return sendError(res, BUSY_ERROR);

  try {
    const data = await runTrends(digests, {
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
