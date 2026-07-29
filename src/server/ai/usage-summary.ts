import { LocalDevelopmentStorage, summarize } from './durable-control';

export async function getAdministrativeUsageSummary(storage = new LocalDevelopmentStorage()) {
  const events = await storage.events.list(); const period = new Date().toISOString().slice(0, 7); const budget = await storage.budget.get(period); return summarize(events, budget);
}
