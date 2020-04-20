![CI](https://github.com/MarcoPolo/datalog-ui/workflows/CI/badge.svg?branch=master)
## Features

* Differential Datalog
* LeapFrogTrieJoin
* Queries are JS


## TODO

### Rename QueryableVariable to Table and MaterializedTable

### Chained Queries
What does it look like when Query1 changes. It should result in QueryResult1 changing too. But nothing drives that right now.
DerivedTables

### Queries
Each variable can only be in one query

### Retractions
Add counts to indexed relations?


### Recent Data
Create a view on a table. The view gets updated with asserts, but keeps it's own stable/recent/toAdd
Works with watchers

only keeps track of relations in recent when there is a watcher. Then keeps each watcher keeps an index into the array of recents.
When all watchers are past a certain index, we can clear that index for GC.

### Hook up to React


### Hook up to React Native