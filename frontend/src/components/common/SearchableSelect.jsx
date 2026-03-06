import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, required = false, disabled = false, className = '', allowCustom = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const option = options.find(opt => opt.value === value);
        setSelectedOption(option || null);
    }, [value, options]);

    useEffect(() => {
        if (selectedOption) {
            setSearchQuery(selectedOption.label);
        } else if (allowCustom && value) {
            if (searchQuery !== value) {
                setSearchQuery(value);
            }
        } else if (!value) {
            setSearchQuery('');
        }
    }, [selectedOption, value, allowCustom]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setIsFocused(false);
                const option = options.find(opt => opt.value === value);
                if (option) {
                    setSearchQuery(option.label);
                } else if (allowCustom && value) {
                    setSearchQuery(value);
                } else {
                    setSearchQuery('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [options, value, allowCustom]);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (option) => {
        onChange(option.value);
        setIsOpen(false);
        setIsFocused(false);
        setSearchQuery(option.label);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setSearchQuery('');
        setIsOpen(false);
    };

    const containerStyles = {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        ...(isFocused ? {
            borderColor: 'var(--primary-500)',
            boxShadow: '0 0 0 3px var(--primary-100)',
            outline: 'none'
        } : {})
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div
                className={`form-input flex items-center justify-between cursor-pointer ${disabled ? 'bg-gray-100' : 'bg-white'}`}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        setIsFocused(true);
                    }
                }}
                style={containerStyles}
            >
                <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none p-0"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => {
                        const newVal = e.target.value;
                        setSearchQuery(newVal);
                        setIsOpen(true);
                        if (allowCustom) {
                            onChange(newVal);
                        }
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        setIsOpen(true);
                    }}
                    disabled={disabled}
                    required={required && !value}
                    style={{
                        width: '100%',
                        fontSize: 'inherit',
                        color: 'inherit',
                        fontFamily: 'inherit',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0
                    }}
                />
                <div className="flex items-center gap-1">
                    {value && !disabled && (
                        <X
                            size={16}
                            className="text-gray-400 hover:text-gray-600 cursor-pointer"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-xs ${option.value === value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                                onClick={() => handleSelect(option)}
                            >
                                {option.label}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                            {allowCustom && searchQuery ? (
                                <span className="text-primary-600 cursor-pointer" onClick={() => {
                                    handleSelect({ value: searchQuery, label: searchQuery });
                                }}>Use "{searchQuery}"</span>
                            ) : 'No results found'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
