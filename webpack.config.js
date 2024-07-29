{
    // rest of the webpack config
    resolve: {
      // ... rest of the resolve config
      fallback: {
        "assert": require.resolve("assert/")
      }
    }
}