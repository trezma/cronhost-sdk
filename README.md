# Cronhost SDK

Official TypeScript SDK for [Cronhost](https://cronho.st) - schedule HTTP requests with cron expressions.

## Installation

```bash
npm install cronhost
```

## Quick Start

```typescript
import { Cronhost } from "cronhost";

const cronhost = new Cronhost({
  apiKey: "ch_your_api_key_here",
});

// Create a new schedule
const schedule = await cronhost.createSchedule({
  name: "Daily Health Check",
  cronExpression: "0 9 * * *", // 9 AM daily
  timezone: "UTC",
  endpoint: "https://api.example.com/health",
  httpMethod: "GET",
});

// Get all schedules
const schedules = await client.getSchedules();

// Get job history
const jobs = await client.getJobs({ scheduleId: schedule.id });
```

## API Reference

### Configuration

```typescript
const cronhost = new Cronhost({
  apiKey: "ch_your_api_key_here",
});
```

### Schedule Management

- `getSchedules()` - List all schedules
- `getSchedule(id)` - Get a specific schedule
- `createSchedule(data)` - Create a new schedule
- `updateSchedule(id, data)` - Update an existing schedule
- `deleteSchedule(id)` - Delete a schedule
- `triggerSchedule(id)` - Manually trigger a schedule
- `toggleSchedule(id, enabled)` - Enable/disable a schedule

### Job Management

- `getJobs(params)` - List jobs with optional filtering
- `getJob(id)` - Get a specific job

## Documentation

For complete API documentation, visit [docs.cronho.st](https://docs.cronho.st)

## License

MIT
