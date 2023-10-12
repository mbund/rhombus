import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

import { db } from "./db";
import { generalChannel } from "./bot";
import { z } from "zod";

export const botRouter = router({
  at: publicProcedure
    .input(
      z.object({
        discordId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const user = await db.user.findFirst({
        where: { discordId: input.discordId },
      });

      console.log(`@${user.name}`);
      generalChannel.send(`<@${input.discordId}> [${user.name} from db]`);
    }),
});

export type BotRouter = typeof botRouter;
