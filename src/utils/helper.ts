import { v4 as uuidv4 } from "uuid"
import fs from "fs/promises"

export function generateId():string {
    return uuidv4().replace(/-/g, "");
}

export async function readJSON(path: string) {
    try {
      const data = await fs.readFile(path, 'utf8');
      const jsonData = JSON.parse(data);
      return jsonData
    } catch (err) {
      console.error('Error reading the file:', err);
    }
}

export async function createDirectoryIfNotExists(directoryPath: string) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
    } catch (err) {
      console.error('Error creating directory:', err);
    }
}

export async function writeDataToFile(filePath: string, data: any) {
    try {
      await fs.writeFile(filePath, data, 'utf8');
    } catch (err) {
      console.error('Error writing to file:', err);
    }
  }