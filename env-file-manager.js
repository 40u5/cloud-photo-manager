import fs from 'fs';
import path from 'path';

class EnvFileManager {
  constructor(envFilePath = '.env') {
    this.envFilePath = path.resolve(envFilePath);
  }

  /**
   * Read the current .env file content
   * @returns {string} The content of the .env file
   */
  readEnvFile() {
    try {
      if (!fs.existsSync(this.envFilePath)) {
        return '';
      }
      return fs.readFileSync(this.envFilePath, 'utf8');
    } catch (error) {
      console.error('Error reading .env file:', error.message);
      return '';
    }
  }

  /**
   * Write content to the .env file
   * @param {string} content - The content to write to the .env file
   */
  writeEnvFile(content) {
    try {
      // Ensure the content ends with a newline
      const finalContent = content ? content + '\n' : '';
      fs.writeFileSync(this.envFilePath, finalContent, 'utf8');
    } catch (error) {
      console.error('Error writing to .env file:', error.message);
      throw error;
    }
  }

  /**
   * Write new lines to the .env file
   * @param {Array<string>} lines - Array of lines to write (e.g., ['KEY=value', 'ANOTHER_KEY=another_value'])
   * @param {boolean} append - Whether to append to existing content (default: true)
   */
  writeLines(lines, append = true) {
    try {
      let currentContent = '';
      
      if (append) {
        currentContent = this.readEnvFile();
      }

      // Filter out empty lines and ensure proper formatting
      const validLines = lines
        .filter(line => line && line.trim() !== '')
        .map(line => line.trim());

      if (validLines.length === 0) {
        console.warn('No valid lines provided to write');
        return;
      }

      // Combine current content with new lines
      const newContent = currentContent + validLines.join('\n');
      
      this.writeEnvFile(newContent);
      
      console.log(`Successfully wrote ${validLines.length} line(s) to .env file`);
    } catch (error) {
      console.error('Error writing lines to .env file:', error.message);
      throw error;
    }
  }

  /**
   * Edit existing lines in the .env file by matching patterns and updating values
   * @param {Array<Object>} edits - Array of edit objects with pattern and newValue
   * @param {string} edits[].pattern - Regex pattern to match lines (e.g., '^DROPBOX_APP_KEY_\\d+=' for matching DROPBOX_APP_KEY_0=, DROPBOX_APP_KEY_1=, etc.)
   * @param {string} edits[].newValue - The new value to set (e.g., 'new_app_key_here')
   * @param {boolean} edits[].replaceEntireLine - Whether to replace the entire line or just the value part (default: false)
   */
  editLines(edits) {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        console.warn('.env file is empty or does not exist');
        return;
      }

      let updatedContent = currentContent;
      let editCount = 0;

      for (const edit of edits) {
        const { pattern, newValue, replaceEntireLine = false } = edit;
        
        if (!pattern || newValue === undefined) {
          console.warn('Invalid edit object: missing pattern or newValue');
          continue;
        }

        const regex = new RegExp(pattern, 'gm');
        
        if (replaceEntireLine) {
          // Replace entire lines that match the pattern
          const matches = updatedContent.match(regex);
          if (matches) {
            updatedContent = updatedContent.replace(regex, newValue);
            editCount += matches.length;
          }
        } else {
          // Replace only the value part (after the = sign)
          const lines = updatedContent.split('\n');
          const updatedLines = lines.map(line => {
            if (regex.test(line)) {
              // Reset regex state for next iteration
              regex.lastIndex = 0;
              
              // Find the position of the first = sign
              const equalIndex = line.indexOf('=');
              if (equalIndex !== -1) {
                editCount++;
                return line.substring(0, equalIndex + 1) + newValue;
              }
            }
            return line;
          });
          updatedContent = updatedLines.join('\n');
        }
      }

      if (editCount > 0) {
        this.writeEnvFile(updatedContent);
        console.log(`Successfully edited ${editCount} line(s) in .env file`);
      } else {
        console.log('No matching lines found to edit');
      }
    } catch (error) {
      console.error('Error editing lines in .env file:', error.message);
      throw error;
    }
  }

  /**
   * Remove lines that match a specific pattern
   * @param {string} pattern - Regex pattern to match lines to remove
   * @returns {number} Number of lines removed
   */
  removeLines(pattern) {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        console.warn('.env file is empty or does not exist');
        return 0;
      }

      const regex = new RegExp(pattern, 'gm');
      const lines = currentContent.split('\n');
      const originalCount = lines.length;
      
      const filteredLines = lines.filter(line => !regex.test(line.trim()));
      
      const removedCount = originalCount - filteredLines.length;
      
      if (removedCount > 0) {
        this.writeEnvFile(filteredLines.join('\n'));
        console.log(`Successfully removed ${removedCount} line(s) from .env file`);
      } else {
        console.log('No matching lines found to remove');
      }
      
      return removedCount;
    } catch (error) {
      console.error('Error removing lines from .env file:', error.message);
      throw error;
    }
  }

  /**
   * Get all lines that match a specific pattern
   * @param {string} pattern - Regex pattern to match lines
   * @returns {Array<string>} Array of matching lines
   */
  getMatchingLines(pattern) {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        return [];
      }

      const regex = new RegExp(pattern, 'gm');
      const lines = currentContent.split('\n');
      
      return lines.filter(line => regex.test(line.trim()));
    } catch (error) {
      console.error('Error getting matching lines from .env file:', error.message);
      return [];
    }
  }

  /**
   * Check if a specific key exists in the .env file
   * @param {string} key - The environment variable key to check
   * @returns {boolean} True if the key exists, false otherwise
   */
  hasKey(key) {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        return false;
      }

      const lines = currentContent.split('\n');
      return lines.some(line => line.trim().startsWith(`${key}=`));
    } catch (error) {
      console.error('Error checking key existence in .env file:', error.message);
      return false;
    }
  }

  /**
   * Get the value of a specific key from the .env file
   * @param {string} key - The environment variable key
   * @returns {string|null} The value of the key, or null if not found
   */
  getValue(key) {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        return null;
      }

      const lines = currentContent.split('\n');
      const line = lines.find(line => line.trim().startsWith(`${key}=`));
      
      if (line) {
        const equalIndex = line.indexOf('=');
        return line.substring(equalIndex + 1);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting value from .env file:', error.message);
      return null;
    }
  }
}

export default EnvFileManager; 