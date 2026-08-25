# BOXIUM Supabase PostgreSQL Production Target：Isolation Record

**Status: created, empty and not connected to BOXIUM runtime.**

| Control | Evidence |
|---|---|
| Project | `BOXIUM Production PostgreSQL` (`bzq…kjtr`) in Boxium organization. |
| Region and status | Singapore `ap-southeast-1`; `ACTIVE_HEALTHY`. |
| Separation | Distinct project/ref from Lab `ekqd…lqew`; Lab remains the schema/synthetic validation environment. |
| Data API | Disabled in the Supabase dashboard after explicit user confirmation; a reopened settings view persisted the off switch and displayed “No schemas can be queried”. No browser REST/GraphQL/Realtime access is permitted. |
| Schema | `public` table inventory is empty. |
| Migrations | Custom migration history is empty. |
| Data | No Production export, dump, import, fixture, credentials or runtime data was used. |
| Runtime | `DATABASE_URL`, `server/db.ts`, Cloud Run, Heartbeat, GitHub production environment/workflow and existing MySQL/TiDB behavior are unchanged. |
| Next boundary | This target cannot receive schema, managed secrets, data or application traffic until separately gated PITR/restore, M06, controlled import and runtime validation phases. |

This target was intentionally created separate from the existing Lab. The current zero-dollar project-creation confirmation does not authorize Pro/compute/PITR charges, data migration or Production cutover.
