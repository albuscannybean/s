# ADR 0002: UUID identity and IndexedDB persistence

Status: Accepted

Knowledge titles are not unique identifiers. UUIDs survive import/export and all representations reference them. IndexedDB provides transactional, versioned local persistence in Web and desktop-hosted origins. Sync is deferred behind future repository adapters; imports surface conflicts and preserve semantic IDs.
