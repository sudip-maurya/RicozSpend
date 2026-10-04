import React, { Children, useEffect, useId, useMemo, useRef, useState } from "react";
import "../styles/dropdown.css";

/**
 * RicozSpend Standardized Dropdown Component
 *
 * Provides a modern, accessible, consistent select/dropdown experience
 * matching the RicozSpend design system.
 */
export default function Dropdown({
  id: propId,
  name,
  value,
  onChange,
  options,
  children,
  placeholder = "Select...",
  disabled = false,
  className = "",
  ariaLabel,
  label,
  align = "left",
  style,
}) {
  const generatedId = useId();
  const id = propId || `rs-dropdown-${generatedId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Normalize options from options prop or children (<option>)
  const normalizedOptions = useMemo(() => {
    if (options && Array.isArray(options) && options.length > 0) {
      return options.map((opt) => {
        if (typeof opt === "object" && opt !== null) {
          return {
            value: opt.value !== undefined ? String(opt.value) : "",
            label: opt.label !== undefined ? String(opt.label) : String(opt.value),
          };
        }
        return {
          value: String(opt),
          label: String(opt),
        };
      });
    }

    if (children) {
      const parsed = [];
      Children.forEach(children, (child) => {
        if (child && child.props) {
          parsed.push({
            value: child.props.value !== undefined ? String(child.props.value) : "",
            label: child.props.children
              ? String(child.props.children)
              : String(child.props.value || ""),
          });
        }
      });
      return parsed;
    }

    return [];
  }, [options, children]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value ?? ""));
  }, [normalizedOptions, value]);

  const displayLabel = selectedOption
    ? selectedOption.label
    : placeholder || (normalizedOptions[0] ? normalizedOptions[0].label : "");

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue) => {
    setIsOpen(false);
    if (disabled) return;
    if (onChange) {
      const syntheticEvent = {
        target: {
          value: optValue,
          name: name || "",
          id: id || "",
        },
        currentTarget: {
          value: optValue,
          name: name || "",
          id: id || "",
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent, optValue);
    }
  };

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      const currentIndex = normalizedOptions.findIndex(
        (opt) => String(opt.value) === String(value ?? "")
      );
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  };

  const handleMenuKeyDown = (event) => {
    if (!isOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev < normalizedOptions.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : normalizedOptions.length - 1
      );
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        handleSelect(normalizedOptions[highlightedIndex].value);
      }
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`rs-dropdown-container ${disabled ? "is-disabled" : ""} ${className}`}
      style={style}
    >
      {label && (
        <label className="rs-dropdown-label" htmlFor={id}>
          {label}
        </label>
      )}

      <div className="rs-dropdown-wrap">
        <button
          type="button"
          id={id}
          className={`rs-dropdown-trigger ${isOpen ? "is-open" : ""}`}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onKeyDown={isOpen ? handleMenuKeyDown : handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={ariaLabel || (typeof label === "string" ? label : undefined)}
          disabled={disabled}
        >
          <span className="rs-dropdown-value" title={displayLabel}>
            {displayLabel}
          </span>
          <svg
            className={`rs-dropdown-chevron ${isOpen ? "is-open" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <ul
            className={`rs-dropdown-menu ${align === "right" ? "align-right" : ""}`}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            aria-activedescendant={
              highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined
            }
          >
            {normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value ?? "");
              const isHighlighted = idx === highlightedIndex;
              return (
                <li
                  key={`${opt.value}-${idx}`}
                  id={`${id}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`rs-dropdown-item ${isSelected ? "is-selected" : ""} ${
                    isHighlighted ? "is-highlighted" : ""
                  }`}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span className="rs-dropdown-item-label" title={opt.label}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span className="rs-dropdown-item-check" aria-hidden="true">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Hidden native select for SSR / forms / screen-readers */}
      <select
        name={name}
        value={value ?? ""}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="rs-dropdown-native-hidden"
        onChange={(e) => handleSelect(e.target.value)}
      >
        {normalizedOptions.map((opt, idx) => (
          <option key={`${opt.value}-${idx}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
