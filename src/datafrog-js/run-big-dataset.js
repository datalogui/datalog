const { Relation, Variable, gallop, joinHelper } = require(".");
const fs = require('fs')
const readline = require('readline')
const stream = require('stream')

const loadEdges2 = async (maxNumberOfEdges) => {
    console.time("Read data")
    const fileBuffer = fs.readFileSync("/Users/marcomunizaga/Downloads/livejournal/soc-LiveJournal1.txt")

    console.timeEnd("Read data")

    const buf = Buffer.from('\t\n#', 'utf8');
    const tab = buf[0]
    const newLine = buf[1]
    const hash = buf[2]

    const edges = []
    // const edges = new Array(maxNumberOfEdges)
    // edges.fill(0)
    let lastNewLine = -1
    let maxLines = maxNumberOfEdges
    let linesSoFar = 0
    console.time("Read 10M lines")
    while (lastNewLine <= fileBuffer.length) {
        const startIdx = lastNewLine + 1
        lastNewLine = -1
        let tabIdx = -1
        let i = 0;
        while (i++ < fileBuffer.length - startIdx) {
            if (fileBuffer[startIdx + i] === tab) {
                tabIdx = startIdx + i
            } else if (fileBuffer[startIdx + i] === newLine) {
                lastNewLine = startIdx + i
                break
            }
        }
        // console.log(tabIdx, lastNewLine)

        if (lastNewLine === -1) {
            break
        }

        // const line = fileBuffer.subarray(startIdx, lastNewLine).toString('utf8')

        if (--maxLines < 0) {
            break
        }

        if (++linesSoFar % 1e7 === 0) {
            console.timeEnd("Read 10M lines")
            console.time("Read 10M lines")
        }

        // Comment
        // if (line[0] === "#") {
        if (fileBuffer[startIdx] === hash) {
            continue
        }


        let fromNode = fileBuffer.slice(startIdx, tabIdx)
        let toNode = fileBuffer.slice(tabIdx + 1, lastNewLine - 1) // -1 because there is a carriage return (\r)
        fromNode = fromNode.toString('utf8')
        toNode = toNode.toString('utf8') // -1 because there is a carriage return (\r)
        // let fromNode = fileBuffer.toString('utf8', startIdx, tabIdx)
        // let toNode = fileBuffer.toString('utf8', tabIdx + 1, lastNewLine - 1) // -1 because there is a carriage return (\r)

        fromNode = parseInt(fromNode)
        toNode = parseInt(toNode)

        edges.push([fromNode, toNode])
        // const [fromNode, toNode] = line.split('\t')
        // edges.push([parseInt(fromNode), parseInt(toNode)])
        // edges[linesSoFar - 1] = line.split('\t').map(n => parseInt(n))
        // edges.push(line.split('\t').map(n => parseInt(n)))
    }
    console.warn('Done loading edges')
    return edges
}


const loadEdges = async (maxNumberOfEdges) => {
    const fileStream = fs.createReadStream("/Users/marcomunizaga/Downloads/livejournal/soc-LiveJournal1.txt", { encoding: "utf8" })
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const edges = []
    let maxLines = maxNumberOfEdges
    let linesSoFar = 0
    console.time("Read 10M lines")
    for await (const line of rl) {

        if (--maxLines < 0) {
            break
        }

        if (++linesSoFar % 1e7 === 0) {
            console.timeEnd("Read 10M lines")
            console.time("Read 10M lines")
        }

        // Comment
        if (line[0] === "#") {
            continue
        }

        edges.push(line.split('\t').map(n => parseInt(n)))
    }
    console.warn('Done loading edges')
    return edges
}

const main = async () => {
    const maxNumberOfEdges = 7e7
    console.time(`Loading ${maxNumberOfEdges} edges`)
    // const edges = await loadEdges(maxNumberOfEdges)
    const edges = await loadEdges2(maxNumberOfEdges)
    console.timeEnd(`Loading ${maxNumberOfEdges} edges`)

    console.time(`Building edges relation`)
    const edgesRel = new Relation(edges)
    console.log("edges count", edgesRel.elements.length)
    console.timeEnd("Building edges relation")
    console.time("Building edges variable")
    const edgesVar = new Variable()
    console.timeEnd("Building edges variable")

    // Our query is: Which nodes can be reached from node 1? Then Map it to get
    // to our tuple form. The second item in the tuple doesn't matter.

    const nodesRel = new Relation([0].map(n => [n, n]))
    const nodesVar = new Variable()

    edgesVar.insert(edgesRel)
    // Run until the insert is stable
    while (edgesVar.changed()) { }

    console.time("Running query")
    nodesVar.insert(nodesRel)
    // Run into we have no new nodes to test our rules against
    while (nodesVar.changed()) {
        // This is the rule: nodes(y) <- nodes(x), edges(x,y)
        nodesVar.fromJoin(edgesVar, (_startNode, _node, endNode) => [endNode, endNode])
    }
    console.timeEnd("Running query")

    // We expect to reach 1, 2, and 3
    console.log(`Done. Found ${nodesVar.stable.map(rel => rel.elements.length).reduce((acc, v) => acc + v)} nodes`)
    nodesVar.stable.reduce((acc, v) => acc.merge(v)).elements.forEach(([n]) => {
        // console.log(n)
    })
}

main().then(() => console.log("done"))