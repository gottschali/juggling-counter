export interface PeakDetector {
    // A return value of
    // 1 means a peak is detected
    // 0 no peak is detected
    // other values are undefined currently
    update(value: number): number
}