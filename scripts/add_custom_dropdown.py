import re

def main():
    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    dropdown_code = '''
const CustomDropdown = ({ options, value, onChange, placeholder = "Select an option..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="custom-dropdown position-relative" ref={dropdownRef}>
      <div 
        className={`form-control bg-dark border-secondary text-white d-flex justify-content-between align-items-center ${isOpen ? 'border-primary shadow-sm' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
      >
        <span className={selectedOption ? '' : 'text-white-50'}>{selectedOption ? selectedOption.label : placeholder}</span>
        <i className="bi bi-chevron-down" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}></i>
      </div>
      
      {isOpen && (
        <div 
          className="position-absolute w-100 mt-1 bg-dark border border-secondary rounded shadow-lg overflow-hidden" 
          style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto' }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-white ${value === opt.value ? 'bg-primary bg-opacity-25 border-start border-primary border-3' : ''}`}
              style={{ cursor: 'pointer', transition: 'background 0.1s' }}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              onMouseEnter={(e) => e.target.classList.add('bg-secondary', 'bg-opacity-50')}
              onMouseLeave={(e) => e.target.classList.remove('bg-secondary', 'bg-opacity-50')}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

'''

    if 'const CustomDropdown' not in content:
        content = content.replace('function App() {', dropdown_code + 'function App() {')
        
    with open(r'f:\Drishti\Drishti\frontend\src\App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
