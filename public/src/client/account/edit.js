// used Chat GPT to update the code to address both warnings
'use strict';

define('forum/account/edit', [
	'forum/account/header',
	'accounts/picture',
	'translator',
	'api',
	'hooks',
	'bootbox',
	'alerts',
	'admin/modules/change-email',
], function (dependencies) {
	const {
		header, picture, translator, api, hooks, bootbox, alerts, changeEmail,
	} = dependencies;

	const AccountEdit = {};

	AccountEdit.init = function () {
		header.init();
		setupEventHandlers();
		handleEmailChange();
	};

	function setupEventHandlers() {
		$('#submitBtn').on('click', updateProfile);

		if (ajaxify.data.groupTitleArray.length === 1 && ajaxify.data.groupTitleArray[0] === '') {
			$('#groupTitle option[value=""]').attr('selected', true);
		}

		handleAccountDelete();
		handleEmailConfirm();
		setupCharCountHandlers();
		handleGroupControls();
	}

	function handleEmailChange() {
		if (!ajaxify.data.isSelf && ajaxify.data.canEdit) {
			$(`a[href="${config.relative_path}/user/${ajaxify.data.userslug}/edit/email"]`).on('click', () => {
				changeEmail.init({
					uid: ajaxify.data.uid,
					email: ajaxify.data.email,
					onSuccess: () => alerts.success('[[user:email-updated]]'),
				});
				return false;
			});
		}
	}

	function updateProfile() {
		const userData = gatherProfileData();
		updateUserProfile(userData);
		return false;
	}

	function gatherProfileData() {
		const userData = $('form[component="profile/edit/form"]').serializeObject();
		userData.uid = ajaxify.data.uid;
		userData.groupTitle = JSON.stringify(getGroupSelection());
		return userData;
	}

	function getGroupSelection() {
		return $('[component="group/badge/list"] [component="group/badge/item"][data-selected="true"]')
			.map((i, el) => $(el).attr('data-value')).get();
	}

	function updateUserProfile(userData) {
		hooks.fire('action:profile.update', userData);

		api.put(`/users/${userData.uid}`, userData).then((res) => {
			alerts.success('[[user:profile-update-success]]');

			if (res.picture) {
				$('#user-current-picture').attr('src', res.picture);
				picture.updateHeader(res.picture);
			}
		}).catch(alerts.error);
	}

	function handleAccountDelete() {
		$('#deleteAccountBtn').on('click', () => {
			translator.translate('[[user:delete-account-confirm]]', (translated) => {
				showDeleteAccountModal(translated);
			});
			return false;
		});
	}

	function showDeleteAccountModal(translated) {
		const modal = bootbox.confirm(translated + '<p><input type="password" class="form-control" id="confirm-password" /></p>', (confirm) => {
			if (!confirm) return;

			const confirmBtn = modal.find('.btn-primary');
			confirmBtn.html('<i class="fa fa-spinner fa-spin"></i>').prop('disabled', true);

			api.del(`/users/${ajaxify.data.uid}/account`, {
				password: $('#confirm-password').val(),
			}, (err) => {
				if (err) {
					restoreDeleteButton(confirmBtn);
					return alerts.error(err);
				}

				confirmBtn.html('<i class="fa fa-check"></i>');
				window.location.href = `${config.relative_path}/`;
			});
		});

		modal.on('shown.bs.modal', () => {
			modal.find('input').focus();
		});
	}

	function restoreDeleteButton(confirmBtn) {
		translator.translate('[[modules:bootbox.confirm]]', (confirmText) => {
			confirmBtn.text(confirmText).prop('disabled', false);
		});
	}

	function handleEmailConfirm() {
		$('#confirm-email').on('click', () => {
			const btn = $('#confirm-email').attr('disabled', true);
			socket.emit('user.emailConfirm', {}, (err) => {
				btn.removeAttr('disabled');
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[notifications:email-confirm-sent]]');
			});
		});
	}

	function setupCharCountHandlers() {
		setupCharCount('#signature', '#signatureCharCountLeft', ajaxify.data.maximumSignatureLength);
		setupCharCount('#aboutme', '#aboutMeCharCountLeft', ajaxify.data.maximumAboutMeLength);
	}

	function setupCharCount(inputSelector, countSelector, maxLength) {
		const el = $(inputSelector);
		$(countSelector).html(getCharsLeft(el, maxLength));

		el.on('keyup change', () => {
			$(countSelector).html(getCharsLeft(el, maxLength));
		});
	}

	function getCharsLeft(el, max) {
		return el.length ? `(${el.val().length}/${max})` : '';
	}

	function handleGroupControls() {
		const { allowMultipleBadges } = ajaxify.data;

		setupGroupToggle('[component="group/toggle/hide"]', 'false', true);
		setupGroupToggle('[component="group/toggle/show"]', 'true', false, allowMultipleBadges);

		setupGroupReordering('[component="group/order/up"]', 'before');
		setupGroupReordering('[component="group/order/down"]', 'after');
	}

	function setupGroupToggle(selector, dataSelected, hidden, allowMultipleBadges = true) {
		$(selector).on('click', function () {
			if (!allowMultipleBadges && dataSelected === 'true') {
				resetGroupSelection();
			}
			const groupEl = $(this).parents('[component="group/badge/item"]');
			groupEl.attr('data-selected', dataSelected);
			$(this).toggleClass('hidden', hidden);
			groupEl.find(selector === '[component="group/toggle/hide"]' ? '[component="group/toggle/show"]' : '[component="group/toggle/hide"]').toggleClass('hidden', !hidden);
		});
	}

	function resetGroupSelection() {
		$('[component="group/badge/list"] [component="group/toggle/show"]').removeClass('hidden');
		$('[component="group/badge/list"] [component="group/toggle/hide"]').addClass('hidden');
		$('[component="group/badge/list"] [component="group/badge/item"]').attr('data-selected', 'false');
	}

	function setupGroupReordering(selector, position) {
		$(selector).on('click', function () {
			const el = $(this).parents('[component="group/badge/item"]');
			el[`insert${position.charAt(0).toUpperCase() + position.slice(1)}`](el[position]());
		});
	}

	return AccountEdit;
});
