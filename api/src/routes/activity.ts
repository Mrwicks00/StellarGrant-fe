import { Router } from "express";
import { Repository } from "typeorm";
import { Activity } from "../entities/Activity";

export const buildActivityRouter = (activityRepo: Repository<Activity>) => {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const cursor = req.query.cursor ? String(req.query.cursor) : null;

      const qb = activityRepo.createQueryBuilder("activity")
        .orderBy("activity.timestamp", "DESC")
        .addOrderBy("activity.id", "DESC")
        .limit(limit + 1); // Fetch one extra to determine if there's a next page

      if (cursor) {
        // Cursor format: "timestamp:id"
        const [timestamp, id] = cursor.split(":");
        qb.andWhere(
          "(activity.timestamp < :timestamp OR (activity.timestamp = :timestamp AND activity.id < :id))",
          { timestamp: new Date(timestamp), id: Number(id) }
        );
      }

      const activities = await qb.getMany();

      let nextCursor: string | null = null;
      if (activities.length > limit) {
        // Remove the extra item
        activities.pop();
        const lastActivity = activities[activities.length - 1];
        nextCursor = `${lastActivity.timestamp.toISOString()}:${lastActivity.id}`;
      }

      res.json({
        data: activities,
        meta: {
          nextCursor,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
