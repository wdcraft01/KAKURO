// Example map: 0 = White cell, 1 = Block/Clue cell
const boardLayout = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1]
];

const gridContainer = document.getElementById('kakuro-grid');

// Before loops run, set the column count custom property in CSS
const totalCols = boardLayout[0].length;
const totalRows = boardLayout.length;

gridContainer.style.setProperty('--grid-cols', totalCols);
gridContainer.style.setProperty('--grid-rows', totalRows);

// Kakuro cell types:
// 'blank' (inactive black cell, no clues)
// 'entry' (playable cell)
// 'clue' (contains sum clues)
class KakuroCell {
    constructor(row, col, type = 'blank') {
        this.row = row;
        this.col = col;
        this.type = type;
        this.correctValue = null; // Used by the generator / validator
        this.userValue    = '';   // Current player input
        this.rowClue      = null;  // Sum for the run to the right
        this.colClue      = null;  // Sum for the run downward

    }
}

class KakuroGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.density = 0.45;
        // Generate matrix of cell objects
        this.grid = this.createEmptyLayout(); 
    }

    createEmptyLayout() {
        let matrix = [];
        for (let r = 0; r < this.height; r++) {
            let row = [];
            for (let c = 0; c < this.width; c++) {
                row.push(new KakuroCell(r, c));
            }
            matrix.push(row);
        }
        return matrix;
    }

    // High-level generation controller
    generatePuzzle() {
        // Generate entry vs non-entry cell locations
        this.carveBoardLayout();

        if (this.fillEntryCells(0,0)) {
            this.calculateSumsFromSolution();
            this.clearEntryCellsForPlay();
            return this.grid;
        } else {
            // Fail-safe: Retry if layout config was
            // mathematically impossible
            return this.generatePuzzle();
        }
    }

    carveBoardLayout() {
        // Construct the layout for the puzzle, using general height
        // and width specifications, a tree-growing approach to
        // developing the entry cells, and maintaining 180-deg
        // rotational symmetry for the playable inner core.

        // (1) Clear all values and initialize the matrix to
        //     solid blocks.
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {

                this.grid[r][c].type = 'blank';
                this.grid[r][c].correctValue = null;
                this.grid[r][c].rowClue = null
                this.grid[r][c].colClue = null
            }
        }
        // Check:
        console.log("Step (1) Complete: Data grid initialized to "
                    + "solid blank blocks.");

        // (2) Choose an initial seed location, intended as the
        //     upper-left corner of an initial 2 x 2 block of entry
        //     cells
        const seed = this.initialSeedLocation();
        // Check:
        console.log("Step (2) Complete: Initial seed location selected, "
                    + "with seed:" + JSON.stringify(seed, null));

        // (3) Define the 2-4 coordinates making up the initial 
        // 2-4 linear block
        const horizontalVertical = getRandomInt(0, 1);
        const initLength = getRandomInt(2, 4);
        const coordsToCarve = []
        if (horizontalVertical === 0) {
            // create an initial horizontal linear block
            for (let dc = 0; dc < initLength; dc++) {
                coordsToCarve.push({r: seed.row, c: seed.col + dc})
            } 
        } else {
            // create an initial vertical linear block
            for (let dr = 0; dr < initLength; dr++) {
                coordsToCarve.push({r: seed.row + dr, c: seed.col})
            }
        }
        // Check:
        console.log("Step (3) Complete: Linear block seed established, "
                    + "with coordsToCarve: ");
        console.table(coordsToCarve);

        // (4) Carve the seed entry cells, along with their symmetrical
        //     collection
        coordsToCarve.forEach(coord => {
            this.grid[coord.r][coord.c].type = 'entry';
            const mirrored = this.getSymmetricCoords(coord.r, coord.c);
            this.grid[mirrored.r][mirrored.c].type = 'entry';
        })
        // Check:
        console.log("Step (4) Complete: Carved out seed entry cells and "
                    + "mirrored collection.");
        console.log("Textual preview of the grid thus far: ");
        this.printPuzzleLayout();

        // (5) Recursively carve remainder of board
        const totalSuccess = this.recursiveGrow();

        if (!totalSuccess) {
            console.error("Failed to generate a valid board layout "
                          + "within constraints.");
            // Handle catastrophic failure and/or restart the seed
        }

        console.log("Step (5) Complete: Layout carved successfully.");

        console.log("Textual preview of the grid thus far: ");
        this.printPuzzleLayout();

    } // END carveBoardLayout()

    recursiveGrow() {
        // Grow the collection of 'entry' cells.

        // Calculate current density
        const currentDensity = this.calculateCurrentDensity();
        console.log("    recursiveGrow(): currentDensity = "
                    + currentDensity.toFixed(3));

        // Get current frontiers
        const frontiers = this.getOpenFrontiers();
        console.log("    recursiveGrow(): obtained the frontier cells "
                    + "(" + frontiers.length + ")");
        // console.table(frontiers);

        if (currentDensity >= this.density && frontiers.length === 0) {
            // Board layout is completely full and legal.
            return true
        }

        if (frontiers.length === 0 && currentDensity < this.density) {
            // Board layout is "trapped"; we must roll back.
            return false;
        }

        // Pick random frontier element
        const randFrontierIndex = getRandomInt(0, frontiers.length - 1);
        const randFrontier = frontiers[randFrontierIndex];
        
        // Loop through random lengths (2-9) and random offsets:
        let lengthOptions = [2, 3, 4, 5, 6, 7, 8, 9];
        if (currentDensity >= this.density) {
            // We are over density, so only allow small extensions
            // to close open gaps
            lengthOptions = [2, 3]
        }
        const randLengths = shuffle(lengthOptions);
        for (const len of randLengths) {
            const _r = randFrontier.r;
            const _c = randFrontier.c;
            let startRow  = 1;
            let endRow    = this.height - 1;
            let startCol  = 1;
            let endCol    =  this.width - 1;
            let possibleRowStarts = [];
            let possibleColStarts = [];
            let proposedCoords = [];
            if (randFrontier.requiredAxis === 'vertical') {
                const minStartRow = Math.max(_r - (len - 1), 1);
                const maxStartRow = Math.min(_r, this.height - len);
                possibleRowStarts = Array.from(
                    { length: len},
                    (_, index) => minStartRow + index);
                possibleRowStarts = shuffle(possibleRowStarts);
                startCol = _c;
                endCol   = _c;
                for (const startRow of possibleRowStarts) {
                    // package proposed line into an array of points
                    proposedCoords = [];
                    for (let row = startRow; row <= startRow + len - 1; row++) {
                        proposedCoords.push({r: row, c: _c});
                    }

                    if (this.isValidRunPlacement(proposedCoords)) {
                        const changedCells = []; // for back-tracking
                        // Commit the coords as 'entry' cells.
                        proposedCoords.forEach(coord => {
                            if (this.grid[coord.r][coord.c].type === 'blank') {
                                this.grid[coord.r][coord.c].type = 'entry';
                                changedCells.push({r: coord.r, c: coord.c});
                                const mirrored = this.getSymmetricCoords(
                                    coord.r, coord.c);
                                this.grid[mirrored.r][mirrored.c].type = 'entry';
                                changedCells.push({r: mirrored.r, c: mirrored.c});
                            }
                        })
                        // Recurse.
                        const success = this.recursiveGrow();
                        if (success) {
                            return true;
                        }

                        // Rollback Phase (block above was not a success)
                        changedCells.forEach(coord => {
                            this.grid[coord.r][coord.c].type = 'blank';
                        })
                    }
                }
                
            } else {
                // requiredAxis === 'horizontal'
                const minStartCol = Math.max(_c - (len - 1), 1);
                const maxStartCol = Math.min(_c, this.width - len);
                possibleColStarts = Array.from(
                    { length: len},
                    (_, index) => minStartCol + index);
                possibleColStarts = shuffle(possibleColStarts);
                startRow = _r;
                endRow   = _r;
                for (const startCol of possibleColStarts) {
                    // package proposed line into an array of points
                    proposedCoords = [];
                    for (let col = startCol; col <= startCol + len - 1; col++) {
                        proposedCoords.push({r: _r, c: col});
                    }

                    if (this.isValidRunPlacement(proposedCoords)) {
                        const changedCells = []; // for back-tracking
                        // Commit the coords as 'entry' cells.
                        proposedCoords.forEach(coord => {
                            if (this.grid[coord.r][coord.c].type === 'blank') {
                                this.grid[coord.r][coord.c].type = 'entry';
                                changedCells.push({r: coord.r, c: coord.c});
                                const mirrored = this.getSymmetricCoords(
                                    coord.r, coord.c);
                                this.grid[mirrored.r][mirrored.c].type = 'entry';
                                changedCells.push({r: mirrored.r, c: mirrored.c});
                            }
                        })
                        // Recurse.
                        const success = this.recursiveGrow();
                        if (success) {
                            return true;
                        }

                        // Rollback Phase (block above was not a success)
                        changedCells.forEach(coord => {
                            this.grid[coord.r][coord.c].type = 'blank';
                        })
                    }
                }
                
            }

        } // end len loop

        // If we tried everything and nothing worked, return false
        // to trigger a back-track step above
        return false;
    }

    calculateCurrentDensity() {
        // Calculate and return the current density of 'entry' cells,
        // i.e., E/T, where E is the number of 'entry' cells and T is
        // the total number of cells in the playable region (the
        // entire region except the first column and first row).

        let entryCount = 0;
        const totalPlayableCellCount = (this.height - 1) * (this.width - 1);

        for (let r = 1; r < this.height; r++) {
            for (let c = 1; c < this.width; c++) {
                if (this.grid[r][c].type === 'entry') {
                    entryCount++;
                }
            }
        }
        return entryCount / totalPlayableCellCount;
    }

    initialSeedLocation() {
        // Generate an initial "seed" location from which to
        // continue generating the rest of the board layout,
        // generating and returning the upper-left coordinate of
        // an intended 2-4 linear strip of initial entry cells.

        const quadrant = getRandomInt(0, 3);
        const width = this.width;
        const height = this.height;
        // (row, col) = (i, j) will be upper left cell in 2 x 2 cluster
        let i = Math.floor(height /  4) + getRandomInt(-1,1);
        let j = Math.floor(width / 4) + getRandomInt(-1,1);
         if (quadrant === 0) {
            // upper-left quadrant: leave i and j alone
         }
         else if (quadrant === 1) {
            // upper-right quadrant: shift rightward by width/2
            j += Math.floor(width / 2);
         }
         else if (quadrant === 2) {
             // lower-right quandrant:
             // shift right by width/2; shift down by height/2
             i += Math.floor(height /  2);
             j += Math.floor(width / 2);
         }
         else { // quadrant === 3
             // lower-left quadrant: shift down by height/2
             i += Math.floor(height /  2);
         }

         // Clamp values so the 2 x 2 block never overwrites the
         // outer border walls
         i = Math.max(1, Math.min(i, height - 4));
         j = Math.max(1, Math.min(j, width - 4));

         // Return the upper-left corner coordinate for an intended
         // length 2-4 linear strip of initial entry cells 
         return { row: i, col: j};
    }

    fillEntryCells(row, col) {

        if (row === this.height) return true;

        let nextRow;
        let nextCol;
        
        if (col < this.width - 1) {
            nextRow = row;
            nextCol = col + 1;
        } else {
            nextRow = row + 1;
            nextCol = 0;
        }

        if (this.grid[row][col].type !== 'entry') {
            return this.fillEntryCells(nextRow, nextCol);
        }

        let digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        for (let num of digits) {
            if (this.isValidPlacement(row, col, num)) {
                this.grid[row][col].correctValue = num;

                if (this.fillEntryCells(nextRow, nextCol)) {
                    return true;
                };
                // otherwise, undo our 'guess', and try next num
                this.grid[row][col].correctValue = null;
            }
        }
    
    // we have failed to complete the filling-in process
    return false;

    }

    isValidPlacement(row, col, num) {
        // Scan left to check current horizontal run for uniqueness
        for (let c = col - 1; c >= 0; c--) {
            if (this.grid[row][c].type !== 'entry') break;
            if (this.grid[row][c].correctValue === num) return false;
        }
        // Scan up to check current vertical run for uniqueness
        for (let r = row - 1; r >= 0; r--) {
            if (this.grid[r][col].type !== 'entry') break;
            if (this.grid[r][col].correctValue === num) return false;
        }
        return true;
    }

    getSymmetricCoords(r, c) {

        // Define symmetrical core boundaries (r > 0 and c > 0)
        const minPlayableRow = 1;
        const maxPlayableRow = this.height - 1;
        const minPlayableCol = 1;
        const maxPlayableCol = this.width - 1;

        const mirrorR = maxPlayableRow - (r - minPlayableRow);
        const mirrorC = maxPlayableCol - (c - minPlayableCol);

        return { r: mirrorR, c: mirrorC };

    }

    getOpenFrontiers() {
        // Find and return a list of all entry cells that have either
        // blank upper and lower neighbors or blank left and right
        // neighbors. Notice that an entry cell should never have both
        // such conditions.
        const frontiers = [];
        for (let r = 1; r < this.height; r++) {
            for (let c = 1; c < this.width; c++) {

                if (this.grid[r][c].type === 'entry') {

                    // Evaluate vertical neighbors / boundaries
                    const topBlank    = this.grid[r-1][c].type === 'blank';
                    // If we are on bottom row, there is no cell below,
                    // which acts like a blank boundary/wall.
                    const bottomBlank = (r === this.height - 1) ?
                        true : (this.grid[r+1][c].type === 'blank');

                    // Evaluate horizontal neighbors / boundaries
                    const leftBlank   = this.grid[r][c-1].type === 'blank';
                    // If we are on far rigth column, there is no cell
                    // to the right, which acts like a blank.
                    const rightBlank  = (c === this.width - 1) ?
                        true : (this.grid[r][c+1].type === 'blank');

                    // Case 1: Isolated vertically (needs vert growth)
                    if (topBlank && bottomBlank) {
                        frontiers.push({ r: r, c: c, requiredAxis: 'vertical'});
                    }

                    // Case 2: Isolated horizontally (needs horiz growth)
                    if (leftBlank && rightBlank) {
                        frontiers.push({ r: r, c: c, requiredAxis: 'horizontal'});
                    }
                }
            }
        }

        return frontiers;
    }

    isValidRunPlacement(coords) {
        // Check if coords are consistent with a valid run placement

        // Check for boundary violation
        const _startRow = coords[0].r;
        const _endRow   = coords[coords.length - 1].r;
        const _startCol = coords[0].c;
        const _endCol = coords[coords.length - 1].c;
        if (_startRow < 1 || _endRow > this.height - 1
            || _startCol < 1 || _endCol > this.width - 1) {
            return false;
        }

        const _direction = 
            (_startRow === _endRow) ? 'horizontal' : 'vertical';
        let _runLength = coords.length;

        // Check for fusion with other runs
        if (_direction === 'vertical') {
            let _currentRow = _startRow - 1;
            let _currentCellIsEntry =
                _currentRow <= 0? false :
                    this.grid[_currentRow][_startCol].type === 'entry';
            while (_currentCellIsEntry) {
                _runLength += 1;
                _currentRow -= 1;
                _currentCellIsEntry =
                    this.grid[_currentRow][_startCol].type === 'entry';

            }
            _currentRow = _endRow + 1;
            _currentCellIsEntry =
                _currentRow >= this.height? false :
                    this.grid[_currentRow][_startCol].type === 'entry';
            while (_currentCellIsEntry) {
                _runLength += 1;
                _currentRow += 1;
                _currentCellIsEntry =
                    _currentRow >= this.height? false :
                        this.grid[_currentRow][_startCol].type === 'entry';
            }

        } else {
            let _currentCol = _startCol - 1;
            let _currentCellEntry = 
                _currentCol <= 0? false :
                    this.grid[_startRow][_currentCol].type === 'entry';
            while (_currentCellEntry) {
                _runLength += 1;
                _currentCol -= 1;
                _currentCellEntry = 
                    this.grid[_startRow][_currentCol].type === 'entry';
            }
            _currentCol = _endCol + 1;
            _currentCellEntry = 
                _currentCol >= this.width? false :
                    this.grid[_startRow][_currentCol].type === 'entry';
            while (_currentCellEntry) {
                _runLength += 1;
                _currentCol += 1;
                _currentCellEntry = 
                    _currentCol >= this.width? false : 
                        this.grid[_startRow][_currentCol].type === 'entry';
            }
        }

        if (_runLength > 9) return false;

        return true;
    }

    printPuzzleLayout() {
        // print a text version of the puzzle layout
        for (let r = 0; r < this.height; r++) {
            let rowStr = "";
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].type === 'entry') {
                    rowStr += "0 ";
                } else if (this.grid[r][c].type === 'clue') {
                    rowStr += "C "
                } else {
                    rowStr += "1 ";
                }
            }
            console.log(rowStr);
        }
    }
    
    calculateSumsFromSolution() {
        // From the underlying grid solution, calculate the run sums
        // and update the corresponding clue cells.

        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {

                const temp_cell = this.grid[r][c];

                if (temp_cell.type === 'clue') {

                    if (temp_cell.rowClue !== null) {
                        // compute row sum
                        let rowSum = 0;
                        let scanCol = c + 1;
                        while (scanCol < this.width
                               && this.grid[r][scanCol].type === 'entry') {
                            rowSum += this.grid[r][scanCol].correctValue;
                            scanCol++;
                        }
                        // update clue cell
                        temp_cell.rowClue = rowSum;
                    }

                    if (temp_cell.colClue !== null) {
                        // compute col sum
                        let colSum = 0;
                        let scanRow = r + 1;
                        while (scanRow < this.height
                               && this.grid[scanRow][c].type === 'entry') {
                            colSum += this.grid[scanRow][c].correctValue;
                            scanRow++;
                        }
                        // update clue cell
                        temp_cell.colClue = colSum;
                    }
                }
            }
        }
    }

    clearEntryCellsForPlay() {
        // Clear entry cells for displaying initial puzzle
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].type === 'entry') {
                    this.grid[r][c].userValue = '';
                }
            }
        }
    }
}

// Choose puzzle size
const puzzleSize = [10, 10]; // (width, height)
const activeGenerator = new KakuroGenerator(puzzleSize[0], puzzleSize[1])

// Generate the puzzle
activeGenerator.generatePuzzle();

// Graphical Injection Engine
function renderBoardToDOM(generator) {
    const gridContainer = document.getElementById('kakuro-grid');

    // Clear out any old HTML nodes inside the container
    gridContainer.innerHTML = "";

    // Dynamically pass our instance dimension to our fluid CSS
    // custom properties
    gridContainer.style.setProperty('--grid-cols', generator.width);
    gridContainer.style.setProperty('--grid-rows', generator.height);

    // Loop through the data engine matrix and generate corresponding
    // HTML elements
    for (let r = 0; r < generator.height; r++) {
        for (let c = 0; c < generator.width; c++) {

            // Retrieve our rich data state object for this coord
            const cellData = generator.grid[r][c];
            const cellElement = document.createElement('div');

            if (cellData.type === 'entry') {
                // Playable cell rendering
                cellElement.className = 'entry-cell';

                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.inputMode = 'numeric';

                input.addEventListener('input', (e) => {
                    // Force text to reflect user inputs inside our
                    // data model layer
                    cellData.userValue = e.target.value.replace(/[^1-9]/g, '');
                    e.target.value = cellData.userValue;
                    checkSolution(generator);
                });

                cellElement.appendChild(input);
            } else if (cellData.type == 'clue') {
                // Clue cell rendering with diagonal CSS line styling
                cellElement.className = 'clue-cell';

                // If vert run exists downward, append a col-clue span elem
                if (cellData.colClue !== null) {
                    const colSpan = document.createElement('span');
                    colSpan.className = 'col-clue';
                    // Temporarily display empty placeholder character
                    // until we have the math engine
                    colSpan.innerText = cellData.colClue;
                    cellElement.appendChild(colSpan);
                }

                // If horiz run exists rightward,
                // append a row-clue span elem
                if (cellData.rowClue !== null) {
                    const rowSpan = document.createElement('span');
                    rowSpan.className = 'row-clue';
                    // Temporarily display empty placeholder character
                    // until we have the math engine
                    rowSpan.innerText = cellData.rowClue;
                    cellElement.appendChild(rowSpan);
                }

            } else {
                // Solid, inactive barrier block rendering
                cellElement.className = 'blank-cell';
            }

            // Append the compiled cell node stright into the fluid
            // CSS grid wrapper
            gridContainer.appendChild(cellElement);
        }
    }
}

// // Execute the rendering
renderBoardToDOM(activeGenerator);

// Cache the UI hint toggle element
const hintToggle = document.getElementById('toggle-hints');

// Add even listener to checkbox to immediately evaluate board
if (hintToggle) {
    hintToggle.addEventListener('change', () => {
        checkSolution(activeGenerator);
    });
}

function checkSolution(generator) {
    // Clear previous validation styling before checking current state
    document.querySelectorAll('.entry-cell').forEach(cell =>
        cell.classList.remove('error'));
    
    // If player does not want hints enabled, stop right here
    if (hintToggle && !hintToggle.checked) {
        return;
    }

    // Otherwise ...
    const totalCols = generator.width;
    const totalRows = generator.height;

    // Cache the visible grid items once so we can color them
    // instantly by linear index
    const domCells = document.getElementById('kakuro-grid').children;

    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {

            const cellData = generator.grid[r][c];

            if (cellData.type === 'clue') {

                // horizontal run validation
                if (cellData.rowClue !== null) {

                    const targetSum = cellData.rowClue;
                    let scanCol = c + 1;
                    let runVisualElements = []; // Stores visual HTML boxes to color later
                    let seenNumbers = new Set();
                    let currentRunSum = 0;
                    let isRunFilled = true;

                    while (scanCol < totalCols
                           && generator.grid[r][scanCol].type === 'entry') {
                        const targetCell = generator.grid[r][scanCol];
                        const inputVal   = targetCell.userValue;

                        // Calc this cell's linear index
                        const visualIndex = (r * totalCols) + scanCol;
                        // Store corresponding visual HTML component
                        runVisualElements.push(domCells[visualIndex]);

                        if (inputVal !== '') {
                            const num = parseInt(inputVal);
                            currentRunSum += num;

                            // Rule Violation: Duplicate digits in same
                            // horizontal track
                            if (seenNumbers.has(num)) {
                                runVisualElements.forEach(cell =>
                                    cell.classList.add('error'))
                            }
                            seenNumbers.add(num);
                        } else {
                            isRunFilled = false; // Run contains empty cells
                        }
                        scanCol++;
                    }

                    // Rule Violation: Segment is fully populated but
                    // adds up incorrectly
                    if (isRunFilled && currentRunSum !== targetSum) {
                        runVisualElements.forEach(cell =>
                            cell.classList.add('error'));
                    }
                }

                // Vertical Run validation
                if (cellData.colClue !== null) {

                    const targetSum = cellData.colClue;
                    let scanRow = r + 1;
                    let runVisualElements = []; // Stores visual HTML boxes to color later
                    let seenNumbers = new Set();
                    let currentRunSum = 0;
                    let isRunFilled = true;

                    while (scanRow < totalRows
                           && generator.grid[scanRow][c].type === 'entry') {
                        const targetCell = generator.grid[scanRow][c];
                        const inputVal   = targetCell.userValue;

                        // Calc this cell's linear index
                        const visualIndex = (scanRow * totalCols) + c;
                        // Store corresponding visual HTML component
                        runVisualElements.push(domCells[visualIndex]);

                        if (inputVal !== '') {
                            const num = parseInt(inputVal);
                            currentRunSum += num;

                            // Rule Violation: Duplicate digits in same
                            // horizontal track
                            if (seenNumbers.has(num)) {
                                runVisualElements.forEach(cell =>
                                    cell.classList.add('error'))
                            }
                            seenNumbers.add(num);
                        } else {
                            isRunFilled = false; // Run contains empty cells
                        }
                        scanRow++;
                    }

                    // Rule Violation: Segment is fully populated but
                    // adds up incorrectly
                    if (isRunFilled && currentRunSum !== targetSum) {
                        runVisualElements.forEach(cell =>
                            cell.classList.add('error'));
                    }
                }
            }
        }
    }
} // end of checkSolution() fxn

/* =========================== */
/*    Utility Functions        */
/* =========================== */

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // Pick random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));
        // Swap elements array[i] and array[j]
        [array[i], array[j]] = [array[j], array[i]]
    }
    return array;
}

function getRandomInt(min, max) {
    // Generate and return a random integer in the interval [min, max]
    // (inclusive).
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
