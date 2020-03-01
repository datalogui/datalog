import * as datalog from './datalog'

test('adds 1 + 2 to equal 3', () => {
    expect(datalog.sum(1, 2)).toBe(3);
});
