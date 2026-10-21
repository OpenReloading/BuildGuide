# Data format

A guide is one JSON or YAML object. `buildguide.schema.json` (JSON Schema 2020-12) describes every key, and the core check (`buildguide-check.mjs`, ported in the MkDocs plugin) checks the cross references the schema cannot: ids, terminals, colours, the per-terminal limit and page links. The [example guide](example/index.md) uses every part of the format.

## Schema

```json
--8<-- "packages/core/schema/buildguide.schema.json"
```

## Example

```json
--8<-- "packages/core/example/guide.json"
```
