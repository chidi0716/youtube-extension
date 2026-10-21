import './style.css';

const checkbox = document.querySelector<HTMLInputElement>('#enabled')!;

checkbox.checked = await enabled.getValue();
checkbox.addEventListener('change', () => enabled.setValue(checkbox.checked));
