/**
 * Word Encryption/Decryption Utilities
 * 
 * Handles progressive encryption and decryption of secret word
 */
export interface EncryptionState {
  word: string;
  encryptedWord: string;
  decryptedPercentage: number;
}

/**
 * Encrypts a percentage of the word by randomly hiding letters
 * @param state Current encryption state
 * @param percentage Percentage to encrypt (0-100)
 * @returns New encryption state
 */
export function encryptWord(
  state: EncryptionState,
  percentage: number = 10
): EncryptionState {
  const { word, encryptedWord, decryptedPercentage } = state;

  // Calculate how many characters should be visible
  const targetVisible = Math.max(0, 100 - decryptedPercentage - percentage);
  const targetHidden = 100 - targetVisible;

  // Get current visible characters
  const visibleIndices: number[] = [];
  for (let i = 0; i < encryptedWord.length; i++) {
    if (encryptedWord[i] !== "_") {
      visibleIndices.push(i);
    }
  }

  // Calculate how many more to hide
  const currentHidden = word.length - visibleIndices.length;
  const needToHide = Math.ceil((targetHidden / 100) * word.length) - currentHidden;

  if (needToHide <= 0) {
    return state; // Already encrypted enough
  }

  // Randomly select indices to hide (excluding already hidden)
  const availableToHide = visibleIndices.filter(() => Math.random() > 0.3);
  const toHide = availableToHide
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(needToHide, availableToHide.length));

  // Create new encrypted word
  let newEncryptedWord = encryptedWord.split("");
  toHide.forEach((idx) => {
    newEncryptedWord[idx] = "_";
  });

  const newDecryptedPercentage = Math.min(100, decryptedPercentage);

  return {
    word,
    encryptedWord: newEncryptedWord.join(""),
    decryptedPercentage: newDecryptedPercentage,
  };
}

/**
 * Decrypts a percentage of the word by revealing hidden letters
 * @param state Current encryption state
 * @param percentage Percentage to decrypt (0-100)
 * @returns New encryption state
 */
export function decryptWord(
  state: EncryptionState,
  percentage: number = 10
): EncryptionState {
  const { word, encryptedWord, decryptedPercentage } = state;

  // Calculate new decrypted percentage
  const newDecryptedPercentage = Math.min(100, decryptedPercentage + percentage);

  // Calculate how many characters should be visible
  const targetVisible = Math.ceil((newDecryptedPercentage / 100) * word.length);

  // Get currently hidden indices
  const hiddenIndices: number[] = [];
  for (let i = 0; i < encryptedWord.length; i++) {
    if (encryptedWord[i] === "_") {
      hiddenIndices.push(i);
    }
  }

  // Calculate how many to reveal
  const currentVisible = word.length - hiddenIndices.length;
  const needToReveal = targetVisible - currentVisible;

  if (needToReveal <= 0) {
    return {
      ...state,
      decryptedPercentage: newDecryptedPercentage,
    };
  }

  // Randomly select indices to reveal
  const toReveal = hiddenIndices
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(needToReveal, hiddenIndices.length));

  // Create new encrypted word
  let newEncryptedWord = encryptedWord.split("");
  toReveal.forEach((idx) => {
    newEncryptedWord[idx] = word[idx];
  });

  return {
    word,
    encryptedWord: newEncryptedWord.join(""),
    decryptedPercentage: newDecryptedPercentage,
  };
}

/**
 * Initializes encryption state for a word
 * @param word Secret word
 * @returns Initial state (fully visible)
 */
export function initializeEncryption(word: string): EncryptionState {
  return {
    word: word.toUpperCase(),
    encryptedWord: "_".repeat(word.length),
    decryptedPercentage: 0,
  };
}
