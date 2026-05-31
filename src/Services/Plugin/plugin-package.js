export const pluginPackage = {
  superhub: 'http://localhost:3005/',
  minified: true,
  widgets: [
    {slug:'design-system>Atom.button@1.0.0', alias: 'Button'}, 
    {slug:'design-system>Atom.button.icon@latest', alias: 'IconButton'},
  ],
  themes: [
    {slug:'design-system>Color.Dark@1.0.0', alias: 'DarkTheme'},
    {slug:'design-system>Color.Light@1.0.0', alias: 'LightTheme'},
  ]
};

export default pluginPackage;

