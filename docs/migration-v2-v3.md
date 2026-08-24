# V2 → V3 migration

Migration runs once when IndexedDB schema 3 opens and `migrationState/v2-to-v3` does not exist.

1. Existing Knowledge, Relations and Representations are copied without changing UUIDs.
2. Each V2 Root LMN becomes a `builtin:lmn-432` Structure Instance.
3. The old LMN UUID becomes the new Instance UUID.
4. Each populated V2 Position becomes an explicit Knowledge Binding with the same Position ID.
5. All V3 built-in Templates are installed.
6. Old `lmns` and `structures` stores remain untouched; bundle migration also carries them under `legacy`.
7. A migration record stores completion time and source counts.

Newly created V3 Knowledge does **not** receive a Structure automatically. This behavior change is intentional and does not retroactively remove migrated LMNs.

If validation fails during bundle import, no current state is replaced. Users can export the V2 bundle as a backup before upgrading.
