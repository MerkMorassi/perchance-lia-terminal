class NumMarkXArray {
    constructor(size) {
        this.size = size;
        this.data = new Array(size * size * size).fill('');
    }

    // Convert 3D indices to 1D index
    to1DIndex(i, j, k) {
        return i * this.size * this.size + j * this.size + k;
    }

    // NumMark-X Encoding: Convert plaintext to concatenated 3-digit ASCII codes
    encodeNumMarkX(plaintext) {
        let encoded = '';
        for (let i = 0; i < plaintext.length; i++) {
            const asciiCode = plaintext.charCodeAt(i);
            // Convert to 3-digit ASCII with leading zeros
            encoded += asciiCode.toString().padStart(3, '0');
        }
        return encoded;
    }

    // NumMark-X Decoding: Convert ASCII codes back to human-readable text
    decodeNumMarkX(asciiCodes) {
        // Validate: length must be divisible by 3
        if (asciiCodes.length % 3 !== 0) {
            return ''; // Return empty response for malformed input
        }

        let decoded = '';
        
        // Process in chunks of exactly 3 digits
        for (let i = 0; i < asciiCodes.length; i += 3) {
            const asciiStr = asciiCodes.substr(i, 3);
            
            // Validate: must be exactly 3 digits
            if (asciiStr.length !== 3) {
                return ''; // Return empty for malformed segment
            }
            
            // Validate: all characters must be digits
            if (!/^\d{3}$/.test(asciiStr)) {
                return ''; // Return empty for non-digit characters
            }
            
            try {
                const asciiValue = parseInt(asciiStr, 10);
                if (asciiValue >= 0 && asciiValue <= 255) {
                    decoded += String.fromCharCode(asciiValue);
                } else {
                    return ''; // Invalid ASCII range
                }
            } catch (error) {
                return ''; // Return empty for conversion errors
            }
        }
        return decoded;
    }

    // Add data using NumMark-X encoding
    addData(i, j, k, plaintext) {
        if (this.isValidIndex(i, j, k)) {
            const index = this.to1DIndex(i, j, k);
            const encoded = this.encodeNumMarkX(plaintext);
            this.data[index] = encoded;
            console.log(`NumMark-X Encoded: "${plaintext}" -> "${encoded}"`);
        } else {
            console.error(`Invalid index (${i}, ${j}, ${k})`);
        }
    }

    // Retrieve and decode data using NumMark-X
    getData(i, j, k) {
        if (this.isValidIndex(i, j, k)) {
            const index = this.to1DIndex(i, j, k);
            const encoded = this.data[index];
            if (encoded === '') {
                return '';
            }
            const decoded = this.decodeNumMarkX(encoded);
            console.log(`NumMark-X Decoded: "${encoded}" -> "${decoded}"`);
            return decoded;
        } else {
            console.error(`Invalid index (${i}, ${j}, ${k})`);
            return '';
        }
    }

    // Get raw NumMark-X encoded data
    getRawNumMarkX(i, j, k) {
        if (this.isValidIndex(i, j, k)) {
            const index = this.to1DIndex(i, j, k);
            return this.data[index];
        }
        return '';
    }

    // Command-line style encode function
    cmdEncode(plaintext) {
        const encoded = this.encodeNumMarkX(plaintext);
        console.log(`/Encode ${plaintext}`);
        console.log(`Output: ${encoded}`);
    }

    // Command-line style decode function
    cmdDecode(asciiCodes) {
        const decoded = this.decodeNumMarkX(asciiCodes);
        console.log(`/Decode ${asciiCodes}`);
        if (decoded === '') {
            console.log('Output: [Empty - Malformed Input]');
        } else {
            console.log(`Output: ${decoded}`);
        }
    }

    // Check if indices are within bounds
    isValidIndex(i, j, k) {
        return i >= 0 && i < this.size && 
               j >= 0 && j < this.size && 
               k >= 0 && k < this.size;
    }
}

// Main execution function
function main() {
    // Create a 3D array using NumMark-X encoding
    const db = new NumMarkXArray(10);

    console.log('=== NumMark-X 3D Array Implementation ===\n');

    // Test NumMark-X specification example
    console.log('--- NumMark-X Specification Test ---');
    db.cmdEncode('Hello, World!');
    db.cmdDecode('072101108108111044032087111114108100033');
    
    console.log('\n--- 3D Array Storage Test ---');
    db.addData(0, 0, 0, 'Hello, World!');
    console.log(`Retrieved: ${db.getData(0, 0, 0)}`);

    console.log('\n--- Various Character Tests ---');
    db.addData(1, 1, 1, 'NumMark-X');
    db.addData(2, 2, 2, '123!@#');
    db.addData(3, 3, 3, 'Special chars: áéíóú');
    
    console.log(`Position (1,1,1): ${db.getData(1, 1, 1)}`);
    console.log(`Position (2,2,2): ${db.getData(2, 2, 2)}`);
    console.log(`Position (3,3,3): ${db.getData(3, 3, 3)}`);

    console.log('\n--- Raw NumMark-X Encoded Data ---');
    console.log(`Raw at (0,0,0): ${db.getRawNumMarkX(0, 0, 0)}`);
    console.log(`Raw at (1,1,1): ${db.getRawNumMarkX(1, 1, 1)}`);

    console.log('\n--- Error Handling Tests ---');
    // Test malformed inputs
    db.cmdDecode('07210110811'); // Not divisible by 3
    db.cmdDecode('07a101108');   // Contains non-digit
    db.cmdDecode('999101108');   // Valid format but high ASCII
    
    console.log('\n--- Overwrite Test ---');
    db.addData(4, 4, 4, 'Original');
    console.log(`First: ${db.getData(4, 4, 4)}`);
    db.addData(4, 4, 4, 'Updated');
    console.log(`Updated: ${db.getData(4, 4, 4)}`);

    console.log('\n--- Empty Data Test ---');
    console.log(`Empty position (5,5,5): '${db.getData(5, 5, 5)}'`);
}

// Run the main function
main();

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumMarkXArray;
}