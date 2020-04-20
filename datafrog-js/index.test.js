const { Relation, Variable, gallop, joinHelper, dedupBy, sortTuple } = require(".");

const sortNumbers = (a, b) => a - b;

describe("dedupBy", () => {
  test("Should dedup array", () => {
    let input = [0, 1, 1, 2, 3, 3,]
    let expected = [0, 1, 2, 3]
    dedupBy(input, (a, b) => a === b)
    expect(input).toEqual(expected)
  })

  test("Should dedup tuples", () => {
    let input = [[1, "bob"], [1, "bob"]]
    expect(sortTuple(input[0], input[1])).toEqual(0);

    dedupBy(input, (a, b) => sortTuple(a, b) === 0)
    expect(input).toEqual([[1, "bob"]]);
  });
})


describe("Relation", () => {
  test("Create should sort + dedup", () => {
    const relation = new Relation(
      [1, 5, 5, 0, 1, 2, 3, 10, 19, 20],
      sortNumbers
    );
    const expectedResult = [0, 1, 2, 3, 5, 10, 19, 20];
    expect(relation.elements).toEqual(expectedResult);
  });

  test("Merging should sort + dedup", () => {
    const relationA = new Relation([1, 5, 5, 0, 1, 2, 3], sortNumbers);
    const relationB = new Relation([5, 2, 2, 6, 0, 9, 2], sortNumbers);
    const expectedResult = [0, 1, 2, 3, 5, 6, 9];
    expect(relationA.merge(relationB).elements).toEqual(expectedResult);
  });

  test("Should dedup tuples", () => {
    let relation = new Relation([[1, "bob"]]);
    expect(relation.elements).toEqual([[1, "bob"]]);
    relation = relation.merge(new Relation([[1, "bob"]]));
    expect(relation.elements).toEqual([[1, "bob"]]);
  });
});

describe("gallop", () => {
  test("Should find the first index for an empty array", () => {
    const array = [];
    expect(gallop(array, n => false)).toEqual(0);
  });
  test("Should find the first index", () => {
    const array = [0, 1, 2, 3, 4, 5];
    expect(gallop(array, n => false)).toEqual(0);
  });

  test("Should return an index out of bounds", () => {
    const array = [0, 1, 2, 3, 4, 5];
    expect(gallop(array, n => true)).toEqual(array.length);
  });

  test("Should find the first index > 3", () => {
    const array = [0, 1, 2, 3, 4, 5];
    expect(gallop(array, n => n < 3)).toEqual(3);
  });

  test("Should find the first index > 3", () => {
    const array = [0, 1, 2, 3, 3, 3, 4, 5];
    expect(gallop(array, n => n < 3)).toEqual(3);
  });
});

describe.skip("joinHelper", () => {
  test("Should find a simple join", () => {
    const relationA = new Relation([[1, "hi"]]);
    const relationB = new Relation([[1, "bob"]]);
    const output = [];

    joinHelper(relationA, relationB, (k, valueA, valueB) =>
      output.push([k, valueA, valueB])
    );

    const expectedResult = [[1, "hi", "bob"]];

    expect(output).toEqual(expectedResult);
  });
  test("Should find joins", () => {
    const relationA = new Relation([
      [1, "hi"],
      [2, "hello"],
      [2, "goodbye"],
      [1, "greetings"]
    ]);
    const relationB = new Relation([
      [1, "bob"],
      [2, "world"],
      [3, "sarah"]
    ]);
    const output = [];

    joinHelper(relationA, relationB, (k, valueA, valueB) =>
      output.push([k, valueA, valueB])
    );

    const expectedResult = [
      [1, "greetings", "bob"],
      [1, "hi", "bob"],
      [2, "goodbye", "world"],
      [2, "hello", "world"]
    ];

    expect(output).toEqual(expectedResult);
  });
});

describe("Variable", () => {
  test("Should move inner relations along", () => {
    const relation = new Relation([
      [1, "bob"],
      [2, "world"],
      [3, "sarah"]
    ]);

    const variable = new Variable();
    variable.insert(relation);

    expect(variable.stable).toEqual([]);
    expect(variable.recent.elements).toEqual([]);
    expect(variable.toAdd).toEqual([relation]);

    // query changed?
    let hasChanged = variable.changed();
    expect(hasChanged).toEqual(true);
    expect(variable.stable).toEqual([]);
    expect(variable.recent).toEqual(relation);
    expect(variable.toAdd).toEqual([]);

    hasChanged = variable.changed();
    expect(hasChanged).toEqual(false);
    expect(variable.stable).toEqual([relation]);
    expect(variable.recent.elements).toEqual([]);
    expect(variable.toAdd).toEqual([]);
  });

  test("Should remove entries already in stable from toAdd", () => {
    const relation = new Relation([[1, "bob"]]);

    const variable = new Variable();
    variable.insert(relation);
    while (variable.changed()) { }

    expect(variable.stable[0]).toEqual(relation);
    expect(variable.recent.elements).toEqual([]);
    expect(variable.toAdd).toEqual([]);

    variable.insert(new Relation([[1, "bob"]]));
    while (variable.changed()) { }

    expect(variable.stable[0]).toEqual(relation);
    expect(variable.recent.elements).toEqual([]);
    expect(variable.toAdd).toEqual([]);
  });

  test.skip("Join from another variable", () => {
    const relationA = new Relation([
      [1, "hi"],
      [2, "hello"],
      [2, "goodbye"],
      [1, "greetings"]
    ]);
    const relationB = new Relation([
      [1, "bob"],
      [2, "world"],
      [3, "sarah"]
    ]);

    const variableA = new Variable();
    const variableB = new Variable();

    variableA.insert(relationA);
    variableB.insert(relationB);
    while (variableB.changed()) { }

    while (variableA.changed()) {
      variableA.fromJoin(variableB, (k, vA, vB) => {
        return [k, vB];
      });
    }

    expect(variableA.recent.elements).toEqual([]);
    expect(variableA.toAdd).toEqual([]);

    expect(variableA.stable.length).toEqual(1);
    expect(variableA.stable[0].elements).toEqual([
      [1, "bob"],
      [1, "greetings"],
      [1, "hi"],
      [2, "goodbye"],
      [2, "hello"],
      [2, "world"]
    ]);
  });
});

describe.skip("Reachability Query", () => {
  test("On a small dataset, run the rule: nodes(y) <- nodes(x), edges(x,y)", () => {
    var smallDataset = require("./smol-dataset.json")
    const edgesRel = new Relation(smallDataset.edges)

    // Our query is: Which nodes can be reached from node 1? Then Map it to get
    // to our tuple form. The second item in the tuple doesn't matter.
    const nodesRel = new Relation([1].map(n => [n, n]))

    const edgesVar = new Variable()
    const nodesVar = new Variable()

    edgesVar.insert(edgesRel)
    // Run until the insert is stable
    while (edgesVar.changed()) { }

    nodesVar.insert(nodesRel)
    // Run into we have no new nodes to test our rules against
    while (nodesVar.changed()) {
      // This is the rule: nodes(y) <- nodes(x), edges(x,y)
      nodesVar.fromJoin(edgesVar, (startNode, _node, endNode) => [endNode, endNode])
    }

    // We expect to reach 1, 2, and 3
    expect(nodesVar.stable[0].elements).toEqual([[1, 1], [2, 2], [3, 3]])
  })
})
