const uniqueSuffix = `${Date.now()}`
const unique = `test-${uniqueSuffix.slice(-8)}`
const uniqueEmail = `john.T${unique}@gmail.com`

export const patient = {
    FIRSTNAME: '',
    MIDDLENAME: '',
    LASTNAME: '',
    EMAIL: uniqueEmail,
}