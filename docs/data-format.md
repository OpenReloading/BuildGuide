# Data format

A guide is one JSON or YAML object. `buildguide.schema.json` (JSON Schema 2020-12) describes every key, and the core check (`buildguide-check.mjs`, ported in the MkDocs plugin) checks the cross references the schema cannot: ids, terminals, colours and the per-terminal limit. The [example pages](example/index.md) use every part of the format.

## Schema

```json
--8<-- "packages/core/schema/buildguide.schema.json"
```

## Example

```json
--8<-- "packages/core/example/guide.json"
```
