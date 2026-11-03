# LiveIndicator
A quiet signal that the page is polling, with time since the last update.

**Provide:** `state` (`live` while active or waiting, `paused` when polling is suspended, `idle` for terminal projects) and `updated` ("4s ago").

- Put it in the project header's side slot or the top bar. Never animate anything else to show liveness.
