/**
 * Displays a notification message on the screen.
 * 
 * @param {string} message The message content to display.
 * @param {'default'|'success'|'warning'|'error'} type The type of notification (influences styling).
 * @param {string} [icon='📢'] An optional icon to display.
 * @returns {HTMLElement|null} The notification element or null if the container isn't found.
 */
const showNotification = (message, type = 'default', icon = '📢') => {
  const container = document.getElementById('notification-container');
  if (!container) {
    console.error('Notification container (#notification-container) not found in the DOM.');
    return null;
  }

  // Create notification element
  const notification = document.createElement('div');
  // Add base class and type-specific class (e.g., 'notification', 'success')
  notification.classList.add('notification', type);

  // Set inner HTML structure
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    </div>
    <button class="notification-close" aria-label="Close notification">&times;</button>
  `;

  // Append to container
  container.appendChild(notification);

  // Get the close button within the newly created notification
  const closeButton = notification.querySelector('.notification-close');
  
  // Function to remove the notification with fade-out effect
  const removeNotification = () => {
    notification.classList.add('notification-hiding');
    // Remove from DOM after fade-out animation (e.g., 300ms)
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  };

  // Add click listener to close button
  if (closeButton) {
    closeButton.addEventListener('click', removeNotification);
  }

  // Trigger fade-in animation slightly after appending
  setTimeout(() => {
    notification.classList.add('notification-visible');
  }, 10); // Small delay ensures transition applies

  // Auto-remove notification after a timeout (e.g., 5 seconds)
  const autoRemoveTimer = setTimeout(removeNotification, 5000);

  // Clear auto-remove timer if closed manually
  if (closeButton) {
      closeButton.addEventListener('click', () => clearTimeout(autoRemoveTimer));
  }

  return notification;
};

export const notificationService = {
  showNotification,
}; 