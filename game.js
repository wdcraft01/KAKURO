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
        // Base case: if we reach the end of the grid, we are done
        if (row === this.height) return true;

        // Move to next row if at the end of columns
        let nextRow = col === this.width - 1 ? row + 1 : row;
        // Move to next column or return to column 0
        let nextCol = col === this.width - 1 ? 0 : col + 1;

        let cell = this.grid[row][col];
        if (cell.type != 'entry') {
            return this.fillEntryCells(nextRow, nextCol);
        }

        // Shuffle an array of [1..9] to introduce randomness
        let digits =
           [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        
        for (let num of digits) {
            if (this.isValidPlacement(row, col, num)) {
                cell.correctValue = num;

                if (this.fillEntryCells(nextRow, nextCol)) {
                    return true;
                }

                cell.correctValue = null; // Backtrack
            }
        }
        return false; // Triggers backtracking to previous cell
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
        const densityFactor = 0.45;

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

        // Test Calculation: pick a test coordinate (1, 1) and
        // calculate its 180-deg diametrically opposite partner.
        const testR = 1;
        const testC = 1;

        // Symmetry Math formula:
        // subtract distance from start margin from end margin
        const mirroredR = maxPlayableRow - (testR - minPlayableRow);
        const mirroredC = maxPlayableCol - (testC - minPlayableCol);

        // Check:
        console.log("Step 1 Complete: Data grid initialized to "
                    + "solid blank blocks.");
        console.log("Step 2 Complete: Symmetrical bounds calculated.");
        console.log("Step 3 Complete: Symmetrical 'entry' tracks carved "
                    + "into memory.");
        console.log("Textual preview of the grid thus far: ")
        for (let r = 0; r < this.height; r++) {
            let rowStr = "";
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].type === 'entry') {
                    rowStr += "0 ";
                } else {
                    rowStr += "1 ";
                }
            }
            console.log(rowStr);
        }
    }
    
    calculateSumsFromSolution() {
        // TBD
    }

    clearEntryCellsForPlay() {
        // TBD
    }
}

// Runtime Viewport Rendering Injection Loop
// Generate the DOM board using the static map
boardLayout.forEach((row, rowIndex) => {
    row.forEach((cellType, colIndex) => {

        const cell = document.createElement('div');

        if (cellType === 0) {
            cell.className = 'entry-cell';
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            // Restrict input to numbers 1-9 via regex review
            input.addEventListener(
                'input', (e) => {
                    e.target.value = e.target.value.replace(/[^1-9]/g,'');
                    checkSolution();
            });
            cell.appendChild(input);
        } else {
            // For showcase, let's hardcode a clue block to test CSS
            if (rowIndex === 0 && colIndex === 1) {
                cell.className = 'clue-cell';
                cell.innerHTML = '<span class="col-clue">7</span>';
            } else if (rowIndex === 1 && colIndex === 0) {
                cell.className = 'clue-cell';
                cell.innerHTML = '<span class="row-clue">4</span>';
            }
            else {
                cell.className = 'blank-cell';
            }
        }

        gridContainer.appendChild(cell);

    });
});

// Cache the UI hint toglle element
const hintToggle = document.getElementById('toggle-hints');

// Add even listener to checkbox to immediately evaluate board
if (hintToggle) {
    hintToggle.addEventListener('change', checkSolution);
}

function checkSolution() {
    // Clear previous validation stying before checking current state
    document.querySelectorAll('.entry-cell').forEach(cell =>
        cell.classList.remove('error'));
    
    // If player does not want hints enables, stop right here
    if (hintToggle && !hintToggle.checked) {
        return;
    }

    // Otherwise ...
    // Capture current values entered by user across the DOM board
    // Once we switch to the dynamic generator, this data will live
    // inside the KakuroCell array instead
    const rows = document.querySelectorAll('#kakuro-grid > div');

    // Convert DOM linear node list back into our 5 x 5 lookup
    // grid for cross-referencing
    let uiGrid = [];
    let cellIndex = 0;
    for (let r = 0; r < totalRows; r++) {
        let rowData = [];
        for (let c = 0; c < totalCols; c++) {
            rowData.push(rows[cellIndex++]);
        }
        uiGrid.push(rowData);
    }

    // Scan for errors: run through each coordinate
    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
            const currentCell = uiGrid[r][c];

            // Look for duplicates or sums extending away
            // from clue blocks
            if (currentCell.classList.contains('clue-cell')) {

                // Fetch the clue limits from the UI text
                const colClueElement = currentCell.querySelector('.col-clue');
                const rowClueElement = currentCell.querySelector('.row-clue');

                // Validate horizontal run (rightward)
                if (rowClueElement) {
                    const targetSum = parseInt(rowClueElement.innerText);
                    let scanCol = c + 1;
                    let runCells = [];
                    let seenNumbers = new Set();
                    let currentRunSum = 0;
                    let isRunFilled = true;

                    while (scanCol < totalCols && uiGrid[r][scanCol].classList.contains('entry-cell')) {
                        const targetCell = uiGrid[r][scanCol];
                        const inputVal   = targetCell.querySelector('input').value;

                        runCells.push(targetCell);

                        if (inputVal !== '') {
                            const num = parseInt(inputVal);
                            currentRunSum += num;

                            // Rule Violation: Duplicate digits in same
                            // horizontal track
                            if (seenNumbers.has(num)) {
                                runCells.forEach(cell =>
                                    cell.classList.add('error'));
                            }
                            seenNumbers.add(num);
                        } else {
                            isRunFilled = false; // Run contains empty cells
                        }
                        scanCol++;
                    }

                    // Rule Violation: Run is filled but total sum incorrect
                    if (isRunFilled && currentRunSum !== targetSum) {
                        runCells.forEach(cell => cell.classList.add('error'));
                    }
                    // Rule Violation: Current numbers already exceed target limit
                    if (!isRunFilled && currentRunSum > targetSum) {
                        runCells.forEach(cell => cell.classList.add('error'));
                    }
                }

                // Validate vertical run (downward)
                if (colClueElement) {
                    const targetSum = parseInt(colClueElement.innerText);
                    let scanRow = r + 1;
                    let runCells = [];
                    let seenNumbers = new Set();
                    let currentRunSum = 0;
                    let isRunFilled = true;

                    while (scanRow < totalRows && uiGrid[scanRow][c].classList.contains('entry-cell')) {
                        const targetCell = uiGrid[scanRow][c];
                        const inputVal = targetCell.querySelector('input').value;

                        runCells.push(targetCell);

                        if (inputVal !== '') {
                            const num = parseInt(inputVal);
                            currentRunSum += num;

                            // Rule Violation: Duplicate digits in same vertical track
                            if (seenNumbers.has(num)) {
                                runCells.forEach(cell => cell.classList.add('error'));
                            }
                            seenNumbers.add(num);
                        } else {
                            isRunFilled = false;
                        }
                        scanRow++;
                    }

                    // Rule violation: Vertical track sums incorrectly
                    if (isRunFilled && currentRunSum !== targetSum) {
                        runCells.forEach(cell => cell.classList.add('error'));
                    }
                    if (!isRunFilled && currentRunSum > targetSum) {
                        runCells.forEach(cell => cell.classList.add('error'));
                    }
                }
        
            }
        }
    }

}

// Test-drive carveBoardLayout() method
const testGen = new KakuroGenerator(10, 10);
testGen.carveBoardLayout();
