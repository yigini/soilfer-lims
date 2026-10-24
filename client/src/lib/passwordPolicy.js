export function minimumPasswordLength(info) {
    const value = info?.passwordPolicy?.minLength;
    return Number.isInteger(value) && value >= 12 && value <= 64 ? value : 12;
}
