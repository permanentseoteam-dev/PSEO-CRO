// Public entry points for wiring into Phase 1 routes (see WIRING.md). All are async server components.
export { WorkloadView } from "./components/workload-view";
export { RecurringPage } from "./components/recurring-page";
export { TicketDependencies, TicketPeopleFields, TicketClientCard, TicketScopeCard } from "./components/ticket-extras";
export { QualityServicesTab, QualityMostRevisedTab, FailedChecksPanel, QUALITY_EXTRA_TABS } from "./components/quality-extras";
