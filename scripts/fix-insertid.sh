#!/bin/bash

# 修正 batchTaskManager.ts
sed -i 's/const taskId = Number(result\[0\]\.insertId);/const result = await db.insert(scheduledTasks).values({\n    taskType,\n    status: "running",\n    totalItems,\n    processedItems: 0,\n    successCount: 0,\n    failureCount: 0,\n    progress: 0,\n    startedAt: new Date(),\n    metadata: JSON.stringify({ errors: [] }),\n  }).returning({ id: scheduledTasks.id });\n\n  const taskId = result[0].id;/g' /home/ubuntu/boxium-ptcg/server/batchTaskManager.ts

echo "✅ Fixed insertId issues"
