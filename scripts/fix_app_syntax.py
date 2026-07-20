import re

def main():
    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    bad_string = "  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });\n  const [comfortReadText, setComfortReadText] = useState(null); = useState({ show: false, message: '', type: 'success' });\n  const [comfortReadText, setComfortReadText] = useState(null);"
    good_string = "  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });\n  const [comfortReadText, setComfortReadText] = useState(null);"

    if bad_string in content:
        content = content.replace(bad_string, good_string)
        with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed App.jsx successfully")
    else:
        # Fallback regex if it's slightly different
        bad_regex = r'const \[comfortReadText,\s*setComfortReadText\] = useState\(null\);\s*=\s*useState\([^)]+\);\s*const \[comfortReadText,\s*setComfortReadText\] = useState\(null\);'
        if re.search(bad_regex, content):
            content = re.sub(bad_regex, 'const [comfortReadText, setComfortReadText] = useState(null);', content)
            with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'w', encoding='utf-8') as f:
                f.write(content)
            print("Fixed App.jsx via regex successfully")
        else:
            print("Could not find the exact bad string")

if __name__ == "__main__":
    main()
