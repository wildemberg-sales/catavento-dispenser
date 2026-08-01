import { z } from "zod";

export const onlineOperatorSchema = z.object({
  operatorId: z.string().uuid(),
  displayName: z.string(),
});
export type OnlineOperator = z.infer<typeof onlineOperatorSchema>;

export const onlineOperatorsResponseSchema = z.object({
  items: z.array(onlineOperatorSchema),
});
export type OnlineOperatorsResponse = z.infer<typeof onlineOperatorsResponseSchema>;
