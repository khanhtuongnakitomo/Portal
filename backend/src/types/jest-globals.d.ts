declare module '@jest/globals' {
  export const jest: {
    fn<T, Y extends unknown[]>(implementation?: (...args: Y) => T): jest.Mock<T, Y>;
  };
}
