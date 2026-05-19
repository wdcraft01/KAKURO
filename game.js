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

    carveBoardLayout() {
        // Construct the layout for the puzzle, using general height
        // and width specifications and maintaining 180-deg rotational
        // symmetry for the playable inner core.

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

        // (2) Define symmetrical core boundaries (r > 0 and c > 0)
        const minPlayableRow = 1;
        const maxPlayableRow = this.height - 1;
        const minPlayableCol = 1;
        const maxPlayableCol = this.width - 1;

        // (3) Run the symmetry loop through the first half of rows
        // Adjust this factor to change how many cells become entry
        // spaces (lower = more entry spaces)
        const densityFactor = 0.25;

        for (let r = minPlayableRow; r <= maxPlayableRow; r++) {

            // Breaking Condition: If we cross the vertical halfway
            // point of the core, stop looping completely so we don't
            // overwrite our mirrored pairs.
            if (r > Math.ceil(maxPlayableRow / 2)) {
                break;
            }

            for (let c = minPlayableCol; c <= maxPlayableCol; c++) {

                // Conditional Break: If we are on the exact middle
                // row of an odd-sized grid, we only need to scan up
                // to the horizontal halfway column.
                if (r === Math.ceil(maxPlayableRow / 2)
                    && c > Math.ceil(maxPlayableCol / 2)) {
                        break;
                    }
                
                // Randomly decide if this tile shold be a playable
                // entry run
                if (Math.random() > densityFactor) {

                    // Calc mirrored coords
                    const mirroredR = maxPlayableRow - (r - minPlayableRow);
                    const mirroredC = maxPlayableCol - (c - minPlayableCol);

                    // Mutate cell and its mirror image
                    this.grid[r][c].type = 'entry';
                    this.grid[mirroredR][mirroredC].type = 'entry';
                }
            }
        }

        // (4) Iteratively Prune "illegal" orphan entry cells
        let boardChanged = true;

        while (boardChanged) {
            boardChanged = false;

            for (let r = minPlayableRow; r <= maxPlayableRow; r++) {
                for (let c = minPlayableCol; c <= maxPlayableCol; c++) {

                    if (this.grid[r][c].type === 'entry') {

                        // Count length of horizontal seq passing thru here
                        let leftC  = c;
                        let rightC = c;
                        while (leftC >= minPlayableCol
                            && this.grid[r][leftC].type === 'entry') {
                            leftC--;
                        }
                        while (rightC <= maxPlayableCol
                            && this.grid[r][rightC].type === 'entry') {
                            rightC++;
                        }
                        const hRunLength = rightC - leftC - 1;

                        // Count length of vertical seq passing thru here
                        let upR  = r;
                        let downR = r;
                        while (upR >= minPlayableRow
                            && this.grid[upR][c].type === 'entry') {
                            upR--;
                        }
                        while (downR <= maxPlayableRow
                            && this.grid[downR][c].type === 'entry') {
                            downR++;
                        }
                        const vRunLength = downR - upR - 1;

                        // Check our structural rules
                        const isTooShort = (hRunLength === 1 || vRunLength === 1);
                        const isTooLong  = (hRunLength > 9 || vRunLength > 9);

                        if (isTooShort || isTooLong) {
                            this.grid[r][c].type = 'blank';
                            // Find mirrored position
                            const mirroredR = maxPlayableRow - (r - minPlayableRow);
                            const mirroredC = maxPlayableCol - (c - minPlayableCol);
                            this.grid[mirroredR][mirroredC].type = 'blank';

                            // signal that we have changed the board
                            boardChanged = true;
                        }
                    }
                }
            }
        } // end while(boardChanged) loop

        // (5) Identify Clue Block locations and mutate blank blocks
        //     to clue blocks
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {

                // Only concerned with non-entry cells
                if (this.grid[r][c].type === 'blank') {

                    // Check A: 2 playable 'entry' cells directly to right?
                    const hasHorizontalRun = (
                        c + 2 < this.width
                        && this.grid[r][c+1].type === 'entry'
                        && this.grid[r][c+2].type === 'entry'
                    );

                    // Check B: playable 'entry' cell directly below?
                    const hasVerticalRun = (
                        r + 2 < this.height 
                        && this.grid[r+1][c].type === 'entry'
                        && this.grid[r+2][c].type === 'entry');
                    
                    if (hasHorizontalRun || hasVerticalRun) {
                        this.grid[r][c].type = 'clue';
                        // Set clues to 0 instead of null to facilate later
                        // updates
                        if (hasHorizontalRun) this.grid[r][c].rowClue = 0;
                        if (hasVerticalRun)   this.grid[r][c].colClue = 0;
                    }
                }
            }
        }

        // Check:
        console.log("Step 1 Complete: Data grid initialized to "
                    + "solid blank blocks.");
        console.log("Step 2 Complete: Symmetrical bounds calculated.");
        console.log("Step 3 Complete: Symmetrical 'entry' tracks carved "
                    + "into memory.");
        console.log("Step 4 Complete: Isolated 'entry' cells converted "
                    + "to solid blank blocks.");
        console.log("Textual preview of the grid thus far: ")
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
