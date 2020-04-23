## A Differential Datalog Implementation in JS

An implementation of Datalog with a focus on managing UIs & UI state.

## Features

* Expressive and simple querying syntax
* Differential updates.
  * Only run queries on the differences in data. Don't run the query on everything every time.
* Query your Queries
  * Run queries on the results of your queries. It's queries all the way down.
* Typed schema and types.
* Works with [React](https://gitlab.com/datalogui/react).

## Examples

Who is the parent of Alice?

```ts
import * as datalog from '@datalogui/datalog'

// First we create our Datalog Table. This is what holds our data
const People = datalog.newTable<{ id: number, name: string }>({
    id: datalog.NumberType,
    name: datalog.StringType,
})

// Add some data
People.assert({id: 0, name: "Alice"})
People.assert({id: 1, name: "Charles"})
People.assert({id: 2, name: "Helen"})

// Define a new table for the ParentOf Relation
const ParentOf = datalog.newTable<{ parentID: number, childID: number }>({
    parentID: datalog.NumberType,
    childID: datalog.NumberType,
})

ParentOf.assert({parentID: 1, childID: 0})
ParentOf.assert({parentID: 2, childID: 0})

// Our query. You can think of this as saying:
// Find me a parentName, parentID, and childID such that
// There is a there is a person named "Alice" and their id is childID
// The parent of childID should be parentID
// and and the name of parentID should be parentName
const Query = datalog.query<{parentName: string, parentID: number, childID: number}>(({parentName, parentID, childID}) => {
  People({name: "Alice", id: childID})
  ParentOf({childID, parentID})
  People({id: parentID, name: parentName})
})

// See the results of the query:
Query.view().readAllData()
// => [{childID: 0, parentID: 1, parentName: "Charles"}, {childID: 0, parentID: 2, parentName: "Helen"}]
```

And what if we wanted to query those results?

```ts
// Give me the ID of anyone named "Helen" from the query above.
const QueryQuery = datalog.query<{parentID: number}>(({parentID}) => {
  Query({parentID, parentName: "Helen"})
})

QueryQuery.view().readAllData()
```
Play with this example [here](https://runkit.com/marcopolo/5ea20f05b9b04d001a07291a).


