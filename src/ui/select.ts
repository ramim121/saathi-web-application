import type { GroupBase, StylesConfig } from 'react-select';

/**
 * react-select styled like the redesigned inputs in `controls.tsx`: same
 * radius, border, focus ring and type size. Use it where a searchable picker
 * earns its keep (hundreds of investors, a dozen projects); a short fixed list
 * should be a native `Select` instead.
 *
 * Inside a Bootstrap modal, also pass `menuPortalTarget={document.body}` so the
 * menu is not clipped; `menuPortal` below lifts it over the modal (z 1055).
 */
export function selectStyles<Option, IsMulti extends boolean = false, Group extends GroupBase<Option> = GroupBase<Option>>(): StylesConfig<
    Option,
    IsMulti,
    Group
> {
    return {
        control: (base, state) => ({
            ...base,
            minHeight: 38,
            borderRadius: 12,
            borderColor: state.isFocused ? '#2b805b' : '#e2e8f0',
            boxShadow: state.isFocused ? '0 0 0 4px rgb(43 128 91 / 0.1)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            backgroundColor: state.isDisabled ? '#f8fafc' : '#fff',
            fontSize: 14,
            cursor: 'pointer',
            '&:hover': { borderColor: state.isFocused ? '#2b805b' : '#cbd5e1' },
        }),
        valueContainer: (base) => ({ ...base, padding: '2px 12px' }),
        placeholder: (base) => ({ ...base, color: '#94a3b8' }),
        singleValue: (base) => ({ ...base, color: '#0f172a' }),
        input: (base) => ({ ...base, color: '#0f172a' }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base, state) => ({
            ...base,
            color: '#94a3b8',
            padding: '0 10px',
            transition: 'transform 150ms',
            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
        }),
        clearIndicator: (base) => ({ ...base, color: '#94a3b8', padding: '0 4px', '&:hover': { color: '#475569' } }),
        menu: (base) => ({
            ...base,
            marginTop: 6,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 32px -8px rgb(16 24 40 / 0.18)',
            overflow: 'hidden',
            zIndex: 30,
        }),
        menuList: (base) => ({ ...base, padding: 4 }),
        option: (base, state) => ({
            ...base,
            borderRadius: 8,
            fontSize: 14,
            padding: '8px 10px',
            cursor: 'pointer',
            color: state.isSelected ? '#06442b' : '#0f172a',
            backgroundColor: state.isSelected ? '#eef7f2' : state.isFocused ? '#f8fafc' : 'transparent',
            '&:active': { backgroundColor: '#d6ece0' },
        }),
        multiValue: (base) => ({ ...base, borderRadius: 8, backgroundColor: '#eef7f2' }),
        multiValueLabel: (base) => ({ ...base, color: '#06442b', fontSize: 12, fontWeight: 500, padding: '2px 6px' }),
        multiValueRemove: (base) => ({ ...base, borderRadius: 8, color: '#2b805b', '&:hover': { backgroundColor: '#d6ece0', color: '#06442b' } }),
        noOptionsMessage: (base) => ({ ...base, fontSize: 13, color: '#64748b' }),
        menuPortal: (base) => ({ ...base, zIndex: 1080 }),
    };
}
