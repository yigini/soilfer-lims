import pathlib
h=pathlib.Path(__file__).resolve().parent
s=(h/'publish-kit-order-native456-import-successor-once.py').read_text(encoding='utf8').splitlines(keepends=True)
prefix=''.join(s[:62])
prefix=prefix.replace("NOTES=pathlib.Path(__file__).with_name('order-native456-publication-notes-once.txt')","NOTES=pathlib.Path(__file__).with_name('sorter-scratch463-publication-notes-once.txt')")
prefix=prefix.replace("D=K/'order-native456-import-successor-publication-once'","D=K/'sorter-scratch463-publication-once'")
prefix=prefix.replace("=='86675b5f8659e6c6533b2ab7ffae9441749ebae2'","=='ee47909e0347cc867f459d4cb6b531a3c91b0ba3'")
prefix=prefix.replace("runs=['order-native456-first','order-native456-second']","runs=['sorter-scratch463-first','sorter-scratch463-second']")
prefix=prefix.replace("zip(runs,[0,0],[456]*2,[198]*2,['OK','OK'])","zip(runs,[1,0],[463]*2,[201]*2,['FAILED (errors=1)','OK'])")
needle="known=set();refs=[]"
assert prefix.count(needle)==1
prefix=prefix.replace(needle,"prior_names.append('order-native456-import-successor-publication-once/new-local-fixtures-hash-inventory.json')\n"+needle)
body=(h/'sorter-scratch463-publisher-body-once.txt').read_text(encoding='utf8')
out=h/'publish-kit-sorter-scratch463-once.py';assert not out.exists();out.write_text(prefix+body,encoding='utf8')
print('New publisher source prepared; publisher not executed.')
