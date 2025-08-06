import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface EditObject {
  pattern: string;
  newValue: string;
  replaceEntireLine?: boolean;
}

class EnvFileManager {
  private static instance: EnvFileManager;
  public envFilePath: string = '';

  constructor(envFilePath: string | null = null) {
    if (EnvFileManager.instance) {
      return EnvFileManager.instance;
    }
    
    if (envFilePath) {
      this.envFilePath = path.resolve(envFilePath);
    } else {
      // Find the project root (where package.json is located)
      const currentFile = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(currentFile);
      
      // Check if we're running from dist directory
      if (currentDir.includes('dist')) {
        // Go up two levels: dist/backend -> dist -> project root
        const projectRoot = path.dirname(path.dirname(currentDir));
        this.envFilePath = path.join(projectRoot, '.env');
      } else {
        // Running from source directory
        const backendDir = currentDir;
        const projectRoot = path.dirname(backendDir);
        this.envFilePath = path.join(projectRoot, '.env');
      }
    }
    
    EnvFileManager.instance = this;
  }

  /**
   * Read the current .env file content
   * @returns The content of the .env file
   */
  readEnvFile(): string {
    try {
      if (!fs.existsSync(this.envFilePath)) {
        return '';
      }
      return fs.readFileSync(this.envFilePath, 'utf8');
    } catch (error) {
      console.error('Error reading .env file:', error instanceof Error ? error.message : 'Unknown error');
      return '';
    }
  }

  /**
   * Write content to the .env file
   * @param content - The content to write to the .env file
   */
  writeEnvFile(content: string): void {
    try {
      // Ensure the content ends with a newline
      const finalContent = content ? content + '\n' : '';
      fs.writeFileSync(this.envFilePath, finalContent, 'utf8');
    } catch (error) {
      console.error('Error writing to .env file:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Write new lines to the .env file
   * @param lines - Array of lines to write (e.g., ['KEY=value', 'ANOTHER_KEY=another_value'])
   * @param append - Whether to append to existing content (default: true)
   */
  writeLines(lines: string[], append: boolean = true): void {
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
      
      console.log(`Successfully wrote ${validLines.length} line(s) to .env file at ${this.envFilePath}`);
    } catch (error) {
      console.error('Error writing lines to .env file:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Edit existing lines in the .env file by matching patterns and updating values
   * @param edits - Array of edit objects with pattern and newValue
   * @param edits[].pattern - Regex pattern to match lines (e.g., '^DROPBOX_APP_KEY_\\d+=' for matching DROPBOX_APP_KEY_0=, DROPBOX_APP_KEY_1=, etc.)
   * @param edits[].newValue - The new value to set (e.g., 'new_app_key_here')
   * @param edits[].replaceEntireLine - Whether to replace the entire line or just the value part (default: false)
   */
  editLines(edits: EditObject[]): void {
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
      console.error('Error editing lines in .env file:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Remove lines that match a specific pattern
   * @param pattern - Regex pattern to match lines to remove
   * @returns Number of lines removed
   */
  removeLines(pattern: string): number {
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
      console.error('Error removing lines from .env file:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get all lines that match a specific pattern
   * @param pattern - Regex pattern to match lines
   * @returns Array of matching lines
   */
  getMatchingLines(pattern: string): string[] {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        return [];
      }

      const regex = new RegExp(pattern, 'gm');
      const lines = currentContent.split('\n');
      
      return lines.filter(line => regex.test(line.trim()));
    } catch (error) {
      console.error('Error getting matching lines from .env file:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Check if a specific key exists in the .env file
   * @param key - The environment variable key to check
   * @returns True if the key exists, false otherwise
   */
  hasKey(key: string): boolean {
    try {
      const currentContent = this.readEnvFile();
      
      if (!currentContent) {
        return false;
      }

      const lines = currentContent.split('\n');
      return lines.some(line => line.trim().startsWith(`${key}=`));
    } catch (error) {
      console.error('Error checking key existence in .env file:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get the value of a specific key from the .env file
   * @param key - The environment variable key
   * @returns The value of the key, or null if not found
   */
  getValue(key: string): string | null {
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
      console.error('Error getting value from .env file:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Create .env file if it doesn't exist
   * @returns True if file was created, false if it already exists
   */
  createEnvFile(): boolean {
    if (fs.existsSync(this.envFilePath)) {
      return false;
    }
    
    fs.writeFileSync(this.envFilePath, '', 'utf8');
    return true;
  }
}

// Export a singleton instance
const envFileManager = new EnvFileManager();
export default envFileManager; 