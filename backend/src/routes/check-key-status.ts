import { Router, Request, Response } from "express";
import { z } from "zod";
import { queryOne, execute } from "../lib/db";

const router = Router();

const BodySchema = z.object({
  key: z.string().min(1),
  deviceFingerprint: z.string().optional(),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, error: "Missing key" });
    return;
  }
  const { key, deviceFingerprint } = parsed.data;

  try {
    const row = await queryOne<{
      id: string;
      active: boolean;
      expires_at: string | null;
      device_fingerprints: string[];
      max_devices: number;
      label: string;
    }>(
      "SELECT id, active, expires_at, device_fingerprints, max_devices, label FROM access_keys WHERE key = $1 LIMIT 1",
      [key]
    );

    if (!row) {
      res.status(404).json({ valid: false, error: "Invalid access key." });
      return;
    }
    if (!row.active) {
      res.status(403).json({ valid: false, error: "This key has been deactivated." });
      return;
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(403).json({ valid: false, error: "This key has expired." });
      return;
    }

    const fingerprints: string[] = row.device_fingerprints || [];
    if (deviceFingerprint && !fingerprints.includes(deviceFingerprint)) {
      if (fingerprints.length >= (row.max_devices || 1)) {
        res.status(403).json({
          valid: false,
          error: `Device limit reached (${row.max_devices}). Contact support.`,
          logout: true // Explicitly tell the client to logout
        });
        return;
      }
      const updated = [...fingerprints, deviceFingerprint];
      await execute(
        "UPDATE access_keys SET device_fingerprints=$1, updated_at=now() WHERE id=$2",
        [updated, row.id]
      );
    }

    res.status(200).json({ valid: true, label: row.label });
  } catch (err) {
    res.status(500).json({ valid: false, error: "Server error" });
  }
});

export default router;
